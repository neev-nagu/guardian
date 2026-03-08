import { Router } from 'express';
import db from '../db/database.js';
import { generateNegotiation } from '../services/negotiationService.js';
import { createQuote, launchOpportunity, getOpportunityStatus, getSubmissions } from '../services/teracService.js';

const router = Router();

// Generate negotiation message
router.post('/generate', async (req, res) => {
  try {
    const { flagId, messageType = 'email', tone = 'firm' } = req.body;

    const flag = db.prepare('SELECT * FROM fraud_flags WHERE id = ?').get(flagId);
    if (!flag) return res.status(404).json({ error: 'Flag not found' });

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(flag.document_id);
    let parsedData = {};
    try { parsedData = JSON.parse(doc.parsed_data || '{}'); } catch {}

    const lineItem = flag.line_item_id
      ? db.prepare('SELECT * FROM line_items WHERE id = ?').get(flag.line_item_id)
      : { description: flag.description, amount: flag.estimated_savings };

    const message = await generateNegotiation({
      flag,
      lineItem,
      document: parsedData,
      messageType,
      tone
    });

    const result = db.prepare(
      'INSERT INTO negotiations (fraud_flag_id, message_type, tone, generated_message) VALUES (?, ?, ?, ?)'
    ).run(flag.id, messageType, tone, message);

    res.json({ id: result.lastInsertRowid, message, messageType, tone });
  } catch (err) {
    console.error('Negotiation error:', err);
    res.status(500).json({ error: 'Failed to generate message' });
  }
});

// Get negotiations for a flag
router.get('/:flagId', (req, res) => {
  const negotiations = db.prepare('SELECT * FROM negotiations WHERE fraud_flag_id = ? ORDER BY created_at DESC')
    .all(req.params.flagId);
  res.json(negotiations);
});

// ── Terac Opportunity Routes ──────────────────────────────────────────────────

// Create a Terac opportunity: quote → launch → store
router.post('/terac/opportunity', async (req, res) => {
  try {
    const { documentId, flagId, taskDescription, panelDescription, timelineHours, submissionCount, uiLink, name } = req.body;

    // Step 1: Get quote
    const quote = await createQuote({ taskDescription, panelDescription, timelineHours, submissionCount });

    // Step 2: Launch opportunity
    const opportunity = await launchOpportunity(quote.quoteId, name || 'Guardian Research Study');

    // Step 3: Store in DB
    const result = db.prepare(`
      INSERT INTO terac_opportunities
        (document_id, flag_id, quote_id, opportunity_id, name, task_description, panel_description,
         timeline_hours, submission_count, ui_link, status, total_cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      documentId || null,
      flagId || null,
      quote.quoteId,
      opportunity.opportunityId,
      name || 'Guardian Research Study',
      taskDescription,
      panelDescription,
      timelineHours,
      submissionCount,
      uiLink || null,
      quote.totalCost || null
    );

    res.json({
      id: result.lastInsertRowid,
      opportunityId: opportunity.opportunityId,
      quoteId: quote.quoteId,
      totalCost: quote.totalCost,
      costPerParticipant: quote.costPerParticipant,
      status: 'pending',
    });
  } catch (err) {
    console.error('Terac opportunity error:', err);
    res.status(500).json({ error: err.message || 'Failed to create opportunity' });
  }
});

// Poll status for an opportunity
router.get('/terac/opportunity/:opportunityId/status', async (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM terac_opportunities WHERE opportunity_id = ?').get(req.params.opportunityId);
    if (!row) return res.status(404).json({ error: 'Opportunity not found' });

    const status = await getOpportunityStatus(req.params.opportunityId);

    // Update status in DB
    db.prepare('UPDATE terac_opportunities SET status = ? WHERE opportunity_id = ?')
      .run(status.status?.toLowerCase() || row.status, req.params.opportunityId);

    res.json({ ...row, status: status.status?.toLowerCase() || row.status, teracData: status });
  } catch (err) {
    console.error('Terac status error:', err);
    res.status(500).json({ error: err.message || 'Failed to get status' });
  }
});

// Fetch and store submissions for an opportunity
router.get('/terac/opportunity/:opportunityId/submissions', async (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM terac_opportunities WHERE opportunity_id = ?').get(req.params.opportunityId);
    if (!row) return res.status(404).json({ error: 'Opportunity not found' });

    const data = await getSubmissions(req.params.opportunityId);
    const submissions = Array.isArray(data) ? data : (data.submissions || []);

    // Upsert submissions (store new ones)
    for (const sub of submissions) {
      const existing = db.prepare('SELECT id FROM terac_submissions WHERE participant_id = ? AND terac_opportunity_id = ?')
        .get(sub.participantId || sub.id, row.id);
      if (!existing) {
        db.prepare('INSERT INTO terac_submissions (terac_opportunity_id, participant_id, data_json) VALUES (?, ?, ?)')
          .run(row.id, sub.participantId || sub.id || null, JSON.stringify(sub));
      }
    }

    // Return stored submissions
    const stored = db.prepare('SELECT * FROM terac_submissions WHERE terac_opportunity_id = ? ORDER BY created_at DESC')
      .all(row.id);

    res.json({
      opportunityId: req.params.opportunityId,
      submissionCount: stored.length,
      submissions: stored.map(s => ({ ...s, data: JSON.parse(s.data_json || '{}') })),
    });
  } catch (err) {
    console.error('Terac submissions error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch submissions' });
  }
});

// Get all opportunities for a document
router.get('/terac/document/:documentId', (req, res) => {
  const opps = db.prepare('SELECT * FROM terac_opportunities WHERE document_id = ? ORDER BY created_at DESC')
    .all(req.params.documentId);
  res.json(opps);
});

export default router;
