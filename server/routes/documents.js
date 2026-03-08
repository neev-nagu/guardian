import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import db from '../db/database.js';
import { extractText } from '../services/ocrService.js';
import { parseDocumentText } from '../services/parserService.js';
import { analyzeForFraud, runMLPrediction, runRuleChecks, explainMLFraud } from '../services/fraudService.js';

const router = Router();

// Upload a document
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { filename, originalname, mimetype, path: filePath } = req.file;

    const result = db.prepare(
      `INSERT INTO documents (filename, original_name, mime_type, file_path, ocr_status)
       VALUES (?, ?, ?, ?, 'processing')`
    ).run(filename, originalname, mimetype, filePath);

    const documentId = result.lastInsertRowid;

    res.json({ documentId, status: 'processing' });

    // Process asynchronously
    processDocument(documentId, filePath).catch(err => {
      console.error(`Pipeline failed for doc ${documentId}:`, err);
      // Check if OCR at least completed
      const doc = db.prepare('SELECT ocr_status FROM documents WHERE id = ?').get(documentId);
      if (doc?.ocr_status === 'completed') {
        // OCR worked, Gemini failed — mark as ocr_complete so user can still see the doc
        db.prepare('UPDATE documents SET status = ? WHERE id = ?').run('ocr_complete', documentId);
      } else {
        db.prepare('UPDATE documents SET ocr_status = ?, status = ? WHERE id = ?')
          .run('failed', 'failed', documentId);
      }
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

async function processDocument(docId, filePath) {
  // Step 1: OCR
  console.log(`[Doc ${docId}] Starting OCR...`);
  const { text, confidence } = await extractText(filePath);
  db.prepare('UPDATE documents SET ocr_text = ?, ocr_status = ? WHERE id = ?')
    .run(text, 'completed', docId);
  console.log(`[Doc ${docId}] OCR complete (confidence: ${confidence})`);

  // Step 2: Parse with Gemini
  console.log(`[Doc ${docId}] Parsing with Gemini...`);
  const parsed = await parseDocumentText(text);
  db.prepare('UPDATE documents SET parsed_data = ?, status = ? WHERE id = ?')
    .run(JSON.stringify(parsed), 'parsed', docId);

  // Step 3: Insert line items
  const insertItem = db.prepare(
    `INSERT INTO line_items (document_id, vendor, description, amount, date, category, raw_text)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  if (parsed.line_items) {
    for (const item of parsed.line_items) {
      insertItem.run(
        docId,
        item.vendor || parsed.vendor,
        item.description,
        item.amount,
        item.date,
        item.category,
        JSON.stringify(item)
      );
    }
  }
  console.log(`[Doc ${docId}] Parsed ${parsed.line_items?.length || 0} line items`);

  // Step 4: Run all fraud analyses in parallel
  console.log(`[Doc ${docId}] Running fraud analysis pipeline...`);
  const lineItems = db.prepare('SELECT * FROM line_items WHERE document_id = ?').all(docId);

  const [mlResult, ruleChecks, geminiFlags] = await Promise.allSettled([
    runMLPrediction(docId, parsed, lineItems),
    runRuleChecks(docId, parsed, lineItems),
    analyzeForFraud(parsed, lineItems)
  ]);

  const ml = mlResult.status === 'fulfilled' ? mlResult.value : null;
  const flags = geminiFlags.status === 'fulfilled' ? geminiFlags.value : [];

  // If ML says fraud, get Gemini explanation
  if (ml?.is_fraud) {
    console.log(`[Doc ${docId}] ML flagged as fraud (${(ml.probability * 100).toFixed(1)}%) — getting Gemini explanation...`);
    await explainMLFraud(parsed, lineItems, ml).catch(e => console.error('[GeminiExplain]', e.message));
  }

  const insertFlag = db.prepare(
    `INSERT INTO fraud_flags (document_id, flag_type, severity, description, confidence, estimated_savings, ai_reasoning)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  for (const flag of flags) {
    insertFlag.run(docId, flag.flag_type, flag.severity, flag.description, flag.confidence, flag.estimated_savings || 0, flag.ai_reasoning);
  }

  db.prepare('UPDATE documents SET status = ? WHERE id = ?').run('analyzed', docId);
  const rules = ruleChecks.status === 'fulfilled' ? ruleChecks.value : [];
  const ruleFails = rules.filter(r => !r.passed).length;
  console.log(`[Doc ${docId}] Done! Gemini: ${flags.length} issues, ML: ${ml?.is_fraud ? 'FRAUD' : 'clean'} (${(ml?.probability * 100 || 0).toFixed(1)}%), Rule checks: ${ruleFails} failed.`);
}

// List all documents
router.get('/', (req, res) => {
  const docs = db.prepare('SELECT * FROM documents ORDER BY upload_date DESC').all();
  res.json(docs);
});

// Get single document with line items
router.get('/:id', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const lineItems = db.prepare('SELECT * FROM line_items WHERE document_id = ?').all(req.params.id);
  const flags = db.prepare('SELECT * FROM fraud_flags WHERE document_id = ?').all(req.params.id);

  res.json({ ...doc, line_items: lineItems, fraud_flags: flags });
});

// Poll status
router.get('/:id/status', (req, res) => {
  const doc = db.prepare('SELECT ocr_status, status FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  res.json(doc);
});

export default router;
