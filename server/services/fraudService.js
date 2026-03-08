import { geminiGenerate } from './geminiClient.js';
import { runPython } from '../utils/pythonRunner.js';
import db from '../db/database.js';

// ---------------------------------------------------------------------------
// 1. Random Forest PKL model prediction
// ---------------------------------------------------------------------------
export async function runMLPrediction(documentId, parsedData, lineItems) {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
  const hour = new Date().getHours();

  // Get historical data for z-score and averages
  const historicalAmounts = db.prepare(`
    SELECT li.amount FROM line_items li
    JOIN documents d ON li.document_id = d.id
    WHERE li.amount IS NOT NULL
    ORDER BY d.upload_date DESC LIMIT 100
  `).all().map(r => r.amount);

  const avgAmount = historicalAmounts.length
    ? historicalAmounts.reduce((s, a) => s + a, 0) / historicalAmounts.length
    : 0;
  const stdDev = historicalAmounts.length > 1
    ? Math.sqrt(historicalAmounts.reduce((s, a) => s + Math.pow(a - avgAmount, 2), 0) / historicalAmounts.length)
    : 1;
  const invoiceAmount = parsedData?.total || 0;
  const zScore = stdDev > 0 ? (invoiceAmount - avgAmount) / stdDev : 0;

  // Count supplier invoices in last 30 days (use vendor name as proxy for supplier)
  const vendor = parsedData?.vendor || '';
  const supplierCount30d = vendor
    ? db.prepare(`
        SELECT COUNT(*) as cnt FROM documents d
        JOIN line_items li ON li.document_id = d.id
        WHERE li.vendor LIKE ?
          AND d.upload_date >= datetime('now', '-30 days')
      `).get(`%${vendor}%`)?.cnt || 0
    : 0;

  // Check for duplicate invoice (same total from same vendor within 7 days)
  const duplicate = vendor && invoiceAmount
    ? db.prepare(`
        SELECT COUNT(*) as cnt FROM documents d
        JOIN line_items li ON li.document_id = d.id
        WHERE li.vendor LIKE ?
          AND ABS(li.amount - ?) < 0.01
          AND d.id != ?
          AND d.upload_date >= datetime('now', '-7 days')
      `).get(`%${vendor}%`, invoiceAmount, documentId)?.cnt > 0
    : false;

  const invoiceDateStr = parsedData?.date;
  const invoiceDate = invoiceDateStr ? new Date(invoiceDateStr) : new Date();

  const features = {
    invoice_amount: invoiceAmount,
    currency: parsedData?.currency || 'USD',
    payment_terms: 'net30',
    invoice_type: parsedData?.document_type === 'invoice' ? 'standard' : 'other',
    submission_hour: hour,
    image_path: doc?.file_path ? 1 : 0,
    supplier_invoice_count_30d: supplierCount30d,
    supplier_avg_amount_90d: avgAmount,
    invoice_amount_zscore: zScore,
    duplicate_invoice_flag: duplicate ? 1 : 0,
    split_invoice_flag: lineItems.length > 5 ? 1 : 0,
    late_night_submission_flag: (hour >= 22 || hour < 5) ? 1 : 0,
    supplier_country: 'US',
    supplier_age_days: 365,
    supplier_risk_score: 0.3,
    blacklisted_flag: 0,
    avg_invoice_amount: avgAmount,
    region: 'north_america',
    annual_budget: 1000000,
    invoice_date: invoiceDate.toISOString().split('T')[0]
  };

  let result;
  try {
    result = await runPython('fraud_predict.py', [JSON.stringify(features)]);
  } catch (err) {
    console.error('[ML] Prediction failed:', err.message);
    result = { prediction: 0, probability: 0, is_fraud: false, error: err.message };
  }

  // Persist prediction
  const saved = db.prepare(`
    INSERT INTO ml_predictions
      (document_id, prediction, probability, is_fraud, features_json, top_features_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    documentId,
    result.prediction ?? 0,
    result.probability ?? 0,
    result.is_fraud ? 1 : 0,
    JSON.stringify(features),
    JSON.stringify(result.top_features || {})
  );

  result._db_id = saved.lastInsertRowid;
  return result;
}

// ---------------------------------------------------------------------------
// 2. Rule-based checks (Benford's, math, duplicates, etc.)
// ---------------------------------------------------------------------------
export async function runRuleChecks(documentId, parsedData, lineItems) {
  // Get all historical amounts for Benford's Law
  const historical = db.prepare(`
    SELECT li.amount FROM line_items li WHERE li.amount IS NOT NULL
  `).all().map(r => r.amount);

  const payload = {
    document: {
      total: parsedData?.total || null,
      subtotal: parsedData?.subtotal || null,
      tax: parsedData?.tax || null,
      vendor: parsedData?.vendor || '',
      date: parsedData?.date || new Date().toISOString(),
      document_type: parsedData?.document_type || 'other',
      upload_date: new Date().toISOString()
    },
    line_items: lineItems.map(li => ({
      amount: li.amount,
      description: li.description,
      vendor: li.vendor,
      date: li.date,
      category: li.category
    })),
    historical_amounts: historical
  };

  let checks = [];
  try {
    checks = await runPython('rule_checks.py', [JSON.stringify(payload)]);
  } catch (err) {
    console.error('[RuleChecks] Failed:', err.message);
    return [];
  }

  // Persist checks to DB
  const insert = db.prepare(`
    INSERT INTO rule_check_results
      (document_id, check_type, passed, severity, details, extra_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const check of checks) {
    const { check: type, passed, severity, details, ...extra } = check;
    insert.run(
      documentId,
      type,
      passed ? 1 : 0,
      severity || 'info',
      details || '',
      JSON.stringify(extra)
    );
  }

  return checks;
}

// ---------------------------------------------------------------------------
// 3. Gemini: general fraud analysis (runs independently of PKL model)
// ---------------------------------------------------------------------------
export async function analyzeForFraud(documentData, lineItems) {
  const prompt = `You are a forensic financial analyst AI. Analyze these charges for problems.

Check for ALL of the following:
1. **Duplicate charges** — same vendor + similar amount appearing multiple times
2. **Unusual price increases** — charges significantly higher than typical rates (>15%)
3. **Hidden fees** — vague descriptions like "service charge", "processing fee", "convenience fee"
4. **Subscription traps** — recurring charges for services that may be unused
5. **Overcharges** — amounts significantly above market average for the service/product
6. **Billing errors** — math errors, charges that don't add up to the total
7. **Suspicious patterns** — any other anomalies a consumer should be aware of

Document context:
${JSON.stringify(documentData, null, 2)}

Line items:
${JSON.stringify(lineItems, null, 2)}

Return ONLY valid JSON as an array of flags:
[
  {
    "flag_type": "duplicate_charge | price_increase | hidden_fee | overcharge | subscription_trap | billing_error | suspicious",
    "severity": "high | medium | low",
    "description": "Clear, consumer-friendly explanation of the issue",
    "confidence": 0.0 to 1.0,
    "estimated_savings": number (estimated $ that could be recovered),
    "ai_reasoning": "Detailed reasoning for why this was flagged",
    "affected_item": "description of the specific line item affected"
  }
]

If no issues are found, return an empty array [].
Be thorough but realistic. Flag real concerns, not trivial ones.`;

  const text = (await geminiGenerate(prompt)).replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// 4. Gemini: explain ML fraud prediction (only called when PKL says fraud)
// ---------------------------------------------------------------------------
export async function explainMLFraud(parsedData, lineItems, mlResult) {
  const prompt = `You are a forensic financial fraud analyst. A machine learning model (Random Forest) has flagged this invoice as potentially fraudulent with ${(mlResult.probability * 100).toFixed(1)}% confidence.

The model's top contributing features were:
${JSON.stringify(mlResult.top_features || {}, null, 2)}

Invoice details:
${JSON.stringify(parsedData, null, 2)}

Line items:
${JSON.stringify(lineItems, null, 2)}

Provide a clear, specific explanation of WHY this invoice is suspicious based on the model's signals and the document content. Focus on:
1. What specific attributes triggered the fraud flags
2. What patterns are unusual compared to legitimate invoices
3. What a financial investigator should look for next

Return ONLY valid JSON:
{
  "summary": "2-3 sentence executive summary",
  "risk_factors": ["specific risk factor 1", "specific risk factor 2", ...],
  "recommended_actions": ["action 1", "action 2", ...],
  "confidence_explanation": "why the model scored ${(mlResult.probability * 100).toFixed(1)}%"
}`;

  try {
    const text = (await geminiGenerate(prompt)).replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const explanation = JSON.parse(text);

    // Persist explanation back to the ml_predictions record
    if (mlResult._db_id) {
      db.prepare('UPDATE ml_predictions SET gemini_explanation = ? WHERE id = ?')
        .run(JSON.stringify(explanation), mlResult._db_id);
    }
    return explanation;
  } catch (err) {
    console.error('[GeminiExplain] Failed:', err.message);
    return null;
  }
}
