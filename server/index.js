import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

import express from 'express';
import cors from 'cors';
import { mkdirSync } from 'fs';

import documentRoutes from './routes/documents.js';
import analysisRoutes from './routes/analysis.js';
import negotiationRoutes from './routes/negotiation.js';
import financialRoutes from './routes/financialStatements.js';
import db from './db/database.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
mkdirSync(join(__dirname, 'uploads'), { recursive: true });

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/documents', documentRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/negotiation', negotiationRoutes);
app.use('/api/financial', financialRoutes);

// Dashboard savings endpoint
app.get('/api/dashboard/savings', (req, res) => {
  const resolved = db.prepare('SELECT COALESCE(SUM(amount_saved), 0) as total FROM savings').get();
  const estimated = db.prepare('SELECT COALESCE(SUM(estimated_savings), 0) as total FROM fraud_flags').get();
  res.json({
    totalSaved: resolved.total,
    estimatedSavings: estimated.total
  });
});

app.listen(PORT, () => {
  console.log(`Guardian server running on http://localhost:${PORT}`);
});
