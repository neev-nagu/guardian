import { Router } from 'express';
import db from '../db/database.js';
import { runPython } from '../utils/pythonRunner.js';

const router = Router();

// GET /api/insights/heatmap
// Returns per-day risk scores for the past 365 days
router.get('/heatmap', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 365;

    const rows = db.prepare(`
      SELECT
        date(d.upload_date) as day,
        COUNT(DISTINCT d.id) as doc_count,
        COUNT(DISTINCT ff.id) as flag_count,
        COUNT(DISTINCT CASE WHEN ff.severity = 'high' THEN ff.id END) as high_flags,
        COUNT(DISTINCT CASE WHEN ff.severity = 'medium' THEN ff.id END) as medium_flags,
        COUNT(DISTINCT CASE WHEN mp.is_fraud = 1 THEN mp.id END) as ml_fraud_count,
        AVG(CASE WHEN mp.probability IS NOT NULL THEN mp.probability ELSE 0 END) as avg_ml_prob,
        COUNT(DISTINCT CASE WHEN rc.passed = 0 THEN rc.id END) as rule_failures
      FROM documents d
      LEFT JOIN fraud_flags ff ON ff.document_id = d.id
      LEFT JOIN ml_predictions mp ON mp.document_id = d.id
      LEFT JOIN rule_check_results rc ON rc.document_id = d.id
      WHERE d.upload_date >= datetime('now', '-${days} days')
      GROUP BY date(d.upload_date)
      ORDER BY day ASC
    `).all();

    const heatmap = rows.map(r => {
      let score = 0;
      score += (r.high_flags * 0.25);
      score += (r.medium_flags * 0.1);
      score += (r.ml_fraud_count * 0.3);
      score += (r.avg_ml_prob * 0.2);
      score += (r.rule_failures * 0.05);
      score = Math.min(1, score);

      return {
        date: r.day,
        risk_score: Math.round(score * 100) / 100,
        doc_count: r.doc_count,
        flag_count: r.flag_count,
        ml_fraud_count: r.ml_fraud_count,
        rule_failures: r.rule_failures,
      };
    });

    res.json(heatmap);
  } catch (err) {
    console.error('Heatmap error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/insights/timeline
// Returns actual monthly P&L aggregates from line_items
router.get('/timeline', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        strftime('%Y-%m', COALESCE(li.date, d.upload_date)) as month,
        SUM(CASE WHEN li.category IN ('income','revenue','reimbursement') THEN li.amount ELSE 0 END) as revenue,
        SUM(CASE WHEN li.category NOT IN ('income','revenue','reimbursement') THEN li.amount ELSE 0 END) as expenses,
        COUNT(DISTINCT d.id) as doc_count,
        COUNT(li.id) as item_count
      FROM line_items li
      JOIN documents d ON li.document_id = d.id
      WHERE li.amount IS NOT NULL
      GROUP BY month
      ORDER BY month ASC
    `).all();

    const timeline = rows.map(r => ({
      month: r.month,
      revenue: Math.round((r.revenue || 0) * 100) / 100,
      expenses: Math.round((r.expenses || 0) * 100) / 100,
      net: Math.round(((r.revenue || 0) - (r.expenses || 0)) * 100) / 100,
      doc_count: r.doc_count,
      item_count: r.item_count,
    }));

    res.json(timeline);
  } catch (err) {
    console.error('Timeline error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/insights/forecast?months=6
// Runs Python linear regression on historical monthly data
router.get('/forecast', async (req, res) => {
  try {
    const forecastMonths = parseInt(req.query.months) || 6;

    // Get historical monthly data first
    const rows = db.prepare(`
      SELECT
        strftime('%Y-%m', COALESCE(li.date, d.upload_date)) as month,
        SUM(CASE WHEN li.category IN ('income','revenue','reimbursement') THEN li.amount ELSE 0 END) as revenue,
        SUM(CASE WHEN li.category NOT IN ('income','revenue','reimbursement') THEN li.amount ELSE 0 END) as expenses
      FROM line_items li
      JOIN documents d ON li.document_id = d.id
      WHERE li.amount IS NOT NULL AND li.amount > 0
      GROUP BY month
      ORDER BY month ASC
    `).all();

    const historical = rows.map(r => ({
      month: r.month,
      revenue: r.revenue || 0,
      expenses: r.expenses || 0,
    }));

    const payload = JSON.stringify({ historical, forecast_months: forecastMonths });
    const result = await runPython('forecast.py', [payload]);

    res.json(result);
  } catch (err) {
    console.error('Forecast error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/insights/digital-twin/base
// Returns the base financial snapshot for the digital twin
router.get('/digital-twin/base', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT
        LOWER(COALESCE(li.category, 'other')) as category,
        SUM(li.amount) as total,
        COUNT(*) as count,
        AVG(li.amount) as avg_amount
      FROM line_items li
      WHERE li.amount IS NOT NULL AND li.amount > 0
        AND LOWER(COALESCE(li.category, 'other')) NOT IN ('income','revenue','reimbursement')
      GROUP BY category
      ORDER BY total DESC
    `).all();

    const revenueRow = db.prepare(`
      SELECT SUM(li.amount) as total
      FROM line_items li
      WHERE LOWER(COALESCE(li.category, 'other')) IN ('income','revenue','reimbursement')
        AND li.amount IS NOT NULL
    `).get();

    const monthly = db.prepare(`
      SELECT
        strftime('%Y-%m', COALESCE(li.date, d.upload_date)) as month,
        SUM(CASE WHEN li.category IN ('income','revenue','reimbursement') THEN li.amount ELSE 0 END) as revenue,
        SUM(CASE WHEN li.category NOT IN ('income','revenue','reimbursement') THEN li.amount ELSE 0 END) as expenses
      FROM line_items li
      JOIN documents d ON li.document_id = d.id
      WHERE li.amount IS NOT NULL
      GROUP BY month
      ORDER BY month DESC
      LIMIT 6
    `).all();

    res.json({
      total_revenue: Math.round((revenueRow?.total || 0) * 100) / 100,
      expense_categories: categories.map(c => ({
        category: c.category,
        total: Math.round(c.total * 100) / 100,
        count: c.count,
        avg: Math.round(c.avg_amount * 100) / 100,
      })),
      recent_monthly: monthly.reverse(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
