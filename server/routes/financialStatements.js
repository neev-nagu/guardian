import { Router } from 'express';
import { runPython } from '../utils/pythonRunner.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

function getDbPath() {
  return process.env.DATABASE_PATH || join(__dirname, '..', 'guardian.db');
}

// GET /api/financial/statements?year=2024&month=3
router.get('/statements', async (req, res) => {
  try {
    const dbPath = getDbPath();
    const args = [dbPath];
    if (req.query.year) args.push(req.query.year);
    if (req.query.month) args.push(req.query.month);

    const statements = await runPython('financial_statements.py', args);

    if (statements.error) {
      return res.status(500).json({ error: statements.error });
    }
    res.json(statements);
  } catch (err) {
    console.error('Financial statements error:', err);
    res.status(500).json({ error: 'Failed to generate financial statements' });
  }
});

export default router;
