import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

// GET /api/terac/respond/:opportunityId — public, fetch task details for the expert form
router.get('/respond/:opportunityId', (req, res) => {
  const row = db.prepare('SELECT * FROM terac_opportunities WHERE opportunity_id = ?').get(req.params.opportunityId);
  if (!row) return res.status(404).json({ error: 'Opportunity not found' });
  res.json({
    opportunityId: row.opportunity_id,
    name: row.name,
    taskDescription: row.task_description,
    panelDescription: row.panel_description,
  });
});

// POST /api/terac/respond/:opportunityId — public, submit expert response
router.post('/respond/:opportunityId', (req, res) => {
  const row = db.prepare('SELECT * FROM terac_opportunities WHERE opportunity_id = ?').get(req.params.opportunityId);
  if (!row) return res.status(404).json({ error: 'Opportunity not found' });

  const { expertName, response } = req.body;
  if (!response?.trim()) return res.status(400).json({ error: 'Response is required' });

  const data = JSON.stringify({
    expertName: expertName || 'Anonymous',
    response,
    submittedAt: new Date().toISOString(),
  });

  const result = db.prepare(
    'INSERT INTO terac_submissions (terac_opportunity_id, participant_id, data_json) VALUES (?, ?, ?)'
  ).run(row.id, expertName || 'Anonymous', data);

  console.log(`\n[Terac] Expert response received for "${row.name}" (${req.params.opportunityId}):`);
  console.log(`  Expert: ${expertName || 'Anonymous'}`);
  console.log(`  Response: ${response.slice(0, 200)}${response.length > 200 ? '...' : ''}\n`);

  res.json({ id: result.lastInsertRowid, status: 'received' });
});

export default router;
