import { Router } from 'express';
import db from '../db/database.js';
import {
  analyzeForFraud,
  runMLPrediction,
  runRuleChecks,
  explainMLFraud
} from '../services/fraudService.js';

const router = Router();

// POST /api/analysis/:documentId — full analysis pipeline
router.post('/:documentId', async (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.documentId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const lineItems = db.prepare('SELECT * FROM line_items WHERE document_id = ?').all(req.params.documentId);
    let parsedData = {};
    try { parsedData = JSON.parse(doc.parsed_data || '{}'); } catch {}

    const docId = parseInt(req.params.documentId);

    // Run all three analyses in parallel
    const [mlResult, ruleChecks, geminiFlags] = await Promise.allSettled([
      runMLPrediction(docId, parsedData, lineItems),
      runRuleChecks(docId, parsedData, lineItems),
      analyzeForFraud(parsedData, lineItems)
    ]);

    const ml = mlResult.status === 'fulfilled' ? mlResult.value : { error: mlResult.reason?.message };
    const rules = ruleChecks.status === 'fulfilled' ? ruleChecks.value : [];
    const flags = geminiFlags.status === 'fulfilled' ? geminiFlags.value : [];

    // If ML model says fraud → get Gemini explanation
    let mlExplanation = null;
    if (ml.is_fraud && !ml.error) {
      mlExplanation = await explainMLFraud(parsedData, lineItems, ml);
    }

    // Persist Gemini fraud flags
    const insertFlag = db.prepare(
      `INSERT INTO fraud_flags (document_id, flag_type, severity, description, confidence, estimated_savings, ai_reasoning)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertedFlags = [];
    for (const flag of flags) {
      const result = insertFlag.run(
        docId,
        flag.flag_type,
        flag.severity,
        flag.description,
        flag.confidence,
        flag.estimated_savings || 0,
        flag.ai_reasoning
      );
      insertedFlags.push({ id: result.lastInsertRowid, ...flag });
    }

    db.prepare('UPDATE documents SET status = ? WHERE id = ?').run('analyzed', docId);

    res.json({
      flags: insertedFlags,
      ml_prediction: { ...ml, gemini_explanation: mlExplanation },
      rule_checks: rules
    });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// GET /api/analysis/:documentId/flags
router.get('/:documentId/flags', (req, res) => {
  const flags = db.prepare('SELECT * FROM fraud_flags WHERE document_id = ? ORDER BY severity DESC')
    .all(req.params.documentId);
  res.json(flags);
});

// GET /api/analysis/:documentId/ml
router.get('/:documentId/ml', (req, res) => {
  const pred = db.prepare('SELECT * FROM ml_predictions WHERE document_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(req.params.documentId);
  if (!pred) return res.status(404).json({ error: 'No ML prediction found' });

  res.json({
    ...pred,
    features: JSON.parse(pred.features_json || '{}'),
    top_features: JSON.parse(pred.top_features_json || '{}'),
    gemini_explanation: pred.gemini_explanation ? JSON.parse(pred.gemini_explanation) : null
  });
});

// GET /api/analysis/:documentId/rules
router.get('/:documentId/rules', (req, res) => {
  const checks = db.prepare('SELECT * FROM rule_check_results WHERE document_id = ? ORDER BY created_at DESC')
    .all(req.params.documentId);
  res.json(checks.map(c => ({
    ...c,
    extra: JSON.parse(c.extra_json || '{}')
  })));
});

// GET /api/analysis/summary/stats
router.get('/summary/stats', (req, res) => {
  const totalFlags = db.prepare('SELECT COUNT(*) as count FROM fraud_flags').get();
  const totalSavings = db.prepare('SELECT COALESCE(SUM(estimated_savings), 0) as total FROM fraud_flags').get();
  const bySeverity = db.prepare('SELECT severity, COUNT(*) as count FROM fraud_flags GROUP BY severity').all();
  const totalResolved = db.prepare('SELECT COALESCE(SUM(amount_saved), 0) as total FROM savings').get();
  const mlFraudCount = db.prepare('SELECT COUNT(*) as count FROM ml_predictions WHERE is_fraud = 1').get();
  const ruleFailCount = db.prepare('SELECT COUNT(*) as count FROM rule_check_results WHERE passed = 0').get();

  res.json({
    totalFlags: totalFlags.count,
    estimatedSavings: totalSavings.total,
    resolvedSavings: totalResolved.total,
    bySeverity: Object.fromEntries(bySeverity.map(r => [r.severity, r.count])),
    mlFraudDetections: mlFraudCount.count,
    ruleFailures: ruleFailCount.count
  });
});

// PUT /api/analysis/flags/:flagId
router.put('/flags/:flagId', (req, res) => {
  const { status, amountSaved } = req.body;
  db.prepare('UPDATE fraud_flags SET status = ? WHERE id = ?').run(status, req.params.flagId);
  if (status === 'resolved' && amountSaved) {
    db.prepare('INSERT INTO savings (fraud_flag_id, amount_saved) VALUES (?, ?)')
      .run(req.params.flagId, amountSaved);
  }
  res.json({ success: true });
});

export default router;
