import { useState, useEffect, useMemo } from 'react';
import { Loader } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { api } from '../api/client';

function fmt(n) {
  const abs = Math.abs(n || 0);
  const sign = (n || 0) < 0 ? '-' : '';
  if (abs >= 1000000) return sign + '$' + (abs / 1000000).toFixed(2) + 'M';
  if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(1) + 'k';
  return sign + '$' + abs.toFixed(2);
}

function pct(v) { return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`; }

const PRESETS = [
  { label: 'Cut 20% OpEx', revAdj: 0, expScale: -20 },
  { label: 'Revenue +30%', revAdj: 30, expScale: 0 },
  { label: 'Scale Up (+50% Rev, +20% Exp)', revAdj: 50, expScale: 20 },
  { label: 'Recession (−30% Rev)', revAdj: -30, expScale: 0 },
  { label: 'Lean Mode (−40% OpEx)', revAdj: 0, expScale: -40 },
];

function DeltaBadge({ base, sim }) {
  const diff = sim - base;
  const pctDiff = base !== 0 ? ((diff / Math.abs(base)) * 100) : 0;
  if (Math.abs(diff) < 0.01) return <span className="twin-delta twin-delta--neutral">No change</span>;
  return (
    <span className={`twin-delta twin-delta--${diff > 0 ? 'pos' : 'neg'}`}>
      {fmt(diff)} ({pct(pctDiff)})
    </span>
  );
}

function Slider({ label, value, onChange, min = -80, max = 200 }) {
  return (
    <div className="twin-slider-row">
      <div className="twin-slider-labels">
        <span>{label}</span>
        <span className={`twin-slider-pct ${value > 0 ? 'pos' : value < 0 ? 'neg' : ''}`}>
          {value > 0 ? '+' : ''}{value}%
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="twin-slider"
      />
    </div>
  );
}

export default function DigitalTwinPage() {
  const [base, setBase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revAdj, setRevAdj] = useState(0);
  const [catAdj, setCatAdj] = useState({});

  useEffect(() => {
    api.getDigitalTwinBase()
      .then(data => {
        setBase(data);
        const init = {};
        data.expense_categories?.forEach(c => { init[c.category] = 0; });
        setCatAdj(init);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sim = useMemo(() => {
    if (!base) return null;
    const simRevenue = base.total_revenue * (1 + revAdj / 100);
    const simCategories = base.expense_categories.map(c => ({
      ...c,
      sim_total: c.total * (1 + (catAdj[c.category] || 0) / 100),
    }));
    const baseExpenses = base.expense_categories.reduce((s, c) => s + c.total, 0);
    const simExpenses = simCategories.reduce((s, c) => s + c.sim_total, 0);
    const baseNet = base.total_revenue - baseExpenses;
    const simNet = simRevenue - simExpenses;
    return { simRevenue, simExpenses, simNet, simCategories, baseExpenses, baseNet };
  }, [base, revAdj, catAdj]);

  function applyPreset(preset) {
    setRevAdj(preset.revAdj);
    if (base) {
      const next = {};
      base.expense_categories.forEach(c => { next[c.category] = preset.expScale; });
      setCatAdj(next);
    }
  }

  function reset() {
    setRevAdj(0);
    const init = {};
    base?.expense_categories?.forEach(c => { init[c.category] = 0; });
    setCatAdj(init);
  }

  const hasChanges = revAdj !== 0 || Object.values(catAdj).some(v => v !== 0);

  if (loading) return <div className="twin-page"><div className="tt-loading"><Loader size={28} className="spinner" /> Loading financial data...</div></div>;
  if (!base) return <div className="twin-page"><div className="tt-empty">No financial data available. Upload documents first.</div></div>;

  const baseExpenses = base.expense_categories.reduce((s, c) => s + c.total, 0);
  const baseNet = base.total_revenue - baseExpenses;

  // Months of data to estimate monthly burn rate
  const monthCount = Math.max(1, base.recent_monthly?.length || 1);
  const avgMonthlyExpenses = baseExpenses / monthCount;
  const avgMonthlyRevenue = base.total_revenue / monthCount;
  const avgMonthlyNet = avgMonthlyRevenue - avgMonthlyExpenses;

  // Break-even: revenue needed to cover all expenses
  const breakEvenRevenue = baseExpenses;
  const revenueGapToBreakEven = breakEvenRevenue - base.total_revenue;

  // Simulated metrics
  const simAvgMonthlyExpenses = sim ? sim.simExpenses / monthCount : 0;
  const simAvgMonthlyNet = sim ? (sim.simRevenue - sim.simExpenses) / monthCount : 0;
  const simBreakEvenRevenue = sim ? sim.simExpenses : 0;

  // Runway: months of cash if net negative (simplified: how long until deficit = total expenses)
  const runwayMonths = avgMonthlyNet < 0 ? Math.abs(baseExpenses / avgMonthlyNet) : Infinity;
  const simRunwayMonths = simAvgMonthlyNet < 0 ? Math.abs(sim?.simExpenses / simAvgMonthlyNet) : Infinity;

  // Gross margin
  const baseMargin = base.total_revenue > 0 ? (baseNet / base.total_revenue) * 100 : 0;
  const simMargin = sim?.simRevenue > 0 ? (sim.simNet / sim.simRevenue) * 100 : 0;

  const chartData = sim?.simCategories.map(c => ({
    name: c.category.length > 12 ? c.category.slice(0, 12) + '…' : c.category,
    Base: Math.round(c.total * 100) / 100,
    Simulated: Math.round(c.sim_total * 100) / 100,
  })) || [];

  const ripples = [];
  if (sim) {
    const revChange = sim.simRevenue - base.total_revenue;
    const expChange = sim.simExpenses - baseExpenses;
    const netChange = sim.simNet - baseNet;
    const marginChange = simMargin - baseMargin;

    if (Math.abs(revChange) > 0.01)
      ripples.push({ label: 'Revenue impact', value: revChange, isPos: revChange > 0 });
    if (Math.abs(expChange) > 0.01)
      ripples.push({ label: 'Expense impact', value: expChange, isPos: expChange < 0 });
    if (Math.abs(netChange) > 0.01)
      ripples.push({ label: 'Net income impact', value: netChange, isPos: netChange > 0 });
    if (Math.abs(marginChange) > 0.1)
      ripples.push({ label: 'Net margin shift', value: marginChange, isPos: marginChange > 0, isPct: true });
    if (runwayMonths !== Infinity || simRunwayMonths !== Infinity) {
      const runwayChange = (simRunwayMonths === Infinity ? 999 : simRunwayMonths) - (runwayMonths === Infinity ? 999 : runwayMonths);
      if (Math.abs(runwayChange) > 0.1) {
        const label = simRunwayMonths === Infinity ? 'Break-even achieved!' : `Runway: ${simRunwayMonths.toFixed(1)} months`;
        ripples.push({ label, value: runwayChange, isPos: runwayChange > 0, isRaw: true });
      }
    }
    const breakEvenGapChange = (simBreakEvenRevenue - sim.simRevenue) - (breakEvenRevenue - base.total_revenue);
    if (Math.abs(breakEvenGapChange) > 0.01)
      ripples.push({ label: 'Break-even revenue gap', value: -breakEvenGapChange, isPos: breakEvenGapChange < 0 });
  }

  return (
    <div className="twin-page">
      <div className="tt-page-header">
        <h1>Digital Twin</h1>
        <p className="tt-sub">Simulate financial scenarios and see ripple effects in real time. No data is changed.</p>
      </div>

      {/* Preset scenarios */}
      <div className="twin-presets">
        <span className="twin-presets-label">Quick Scenarios</span>
        <div className="twin-preset-btns">
          {PRESETS.map(p => (
            <button key={p.label} className="twin-preset-btn" onClick={() => applyPreset(p)}>{p.label}</button>
          ))}
          {hasChanges && <button className="twin-preset-btn twin-preset-btn--reset" onClick={reset}>Reset</button>}
        </div>
      </div>

      {/* Key metrics bar */}
      <div className="twin-metrics-bar">
        <div className="twin-metric-card">
          <span className="twin-metric-card-label">Avg Monthly Burn</span>
          <span className={`twin-metric-card-value ${avgMonthlyNet >= 0 ? 'pos' : 'neg'}`}>{fmt(Math.abs(avgMonthlyExpenses))}/mo</span>
          {hasChanges && <span className={`twin-metric-card-sim ${simAvgMonthlyExpenses < avgMonthlyExpenses ? 'pos' : 'neg'}`}>
            → {fmt(Math.abs(simAvgMonthlyExpenses))}/mo
          </span>}
        </div>
        <div className="twin-metric-card">
          <span className="twin-metric-card-label">Break-Even Revenue</span>
          <span className="twin-metric-card-value">{fmt(breakEvenRevenue)}</span>
          {hasChanges && <span className="twin-metric-card-sim">→ {fmt(simBreakEvenRevenue)}</span>}
          <span className={`twin-metric-card-sub ${revenueGapToBreakEven <= 0 ? 'pos' : 'neg'}`}>
            {revenueGapToBreakEven <= 0 ? `✓ ${fmt(Math.abs(revenueGapToBreakEven))} above break-even` : `${fmt(revenueGapToBreakEven)} gap to break-even`}
          </span>
        </div>
        <div className="twin-metric-card">
          <span className="twin-metric-card-label">Net Margin</span>
          <span className={`twin-metric-card-value ${baseMargin >= 0 ? 'pos' : 'neg'}`}>{baseMargin.toFixed(1)}%</span>
          {hasChanges && <span className={`twin-metric-card-sim ${simMargin >= baseMargin ? 'pos' : 'neg'}`}>→ {simMargin.toFixed(1)}%</span>}
        </div>
        <div className="twin-metric-card">
          <span className="twin-metric-card-label">Monthly Net</span>
          <span className={`twin-metric-card-value ${avgMonthlyNet >= 0 ? 'pos' : 'neg'}`}>{fmt(avgMonthlyNet)}/mo</span>
          {hasChanges && <span className={`twin-metric-card-sim ${simAvgMonthlyNet >= avgMonthlyNet ? 'pos' : 'neg'}`}>→ {fmt(simAvgMonthlyNet)}/mo</span>}
        </div>
      </div>

      {/* Baseline vs Simulated summary */}
      <div className="twin-summary">
        <div className="twin-summary-col">
          <h4>Baseline (Actual)</h4>
          <div className="twin-metric"><span>Revenue</span><span className="pos">{fmt(base.total_revenue)}</span></div>
          <div className="twin-metric"><span>Expenses</span><span className="neg">{fmt(baseExpenses)}</span></div>
          <div className="twin-metric twin-metric--total"><span>Net Income</span><span className={baseNet >= 0 ? 'pos' : 'neg'}>{fmt(baseNet)}</span></div>
        </div>
        <div className="twin-summary-arrow">→</div>
        <div className={`twin-summary-col twin-summary-col--sim ${hasChanges ? 'active' : ''}`}>
          <h4>Simulated</h4>
          <div className="twin-metric">
            <span>Revenue</span>
            <span className="pos">{fmt(sim?.simRevenue)}</span>
            <DeltaBadge base={base.total_revenue} sim={sim?.simRevenue} />
          </div>
          <div className="twin-metric">
            <span>Expenses</span>
            <span className="neg">{fmt(sim?.simExpenses)}</span>
            <DeltaBadge base={baseExpenses} sim={sim?.simExpenses} />
          </div>
          <div className="twin-metric twin-metric--total">
            <span>Net Income</span>
            <span className={sim?.simNet >= 0 ? 'pos' : 'neg'}>{fmt(sim?.simNet)}</span>
            <DeltaBadge base={baseNet} sim={sim?.simNet} />
          </div>
        </div>
      </div>

      <div className="twin-workspace">
        {/* Controls */}
        <div className="twin-controls">
          <div className="twin-controls-header">
            <h4>Adjust Scenario</h4>
          </div>

          <div className="twin-section">
            <label className="twin-section-label">Revenue</label>
            <Slider label="Revenue change" value={revAdj} onChange={setRevAdj} min={-100} max={300} />
          </div>

          {base.expense_categories.length > 0 && (
            <div className="twin-section">
              <label className="twin-section-label">Expense Categories</label>
              {base.expense_categories.map(c => (
                <Slider
                  key={c.category}
                  label={`${c.category} (${fmt(c.total)})`}
                  value={catAdj[c.category] || 0}
                  onChange={v => setCatAdj(prev => ({ ...prev, [c.category]: v }))}
                  min={-100}
                  max={200}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right panel: chart + ripples */}
        <div className="twin-right">
          {chartData.length > 0 && (
            <div className="twin-chart-wrap">
              <h4>Expense Breakdown: Base vs Simulated</h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => '$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v)} />
                  <Tooltip
                    formatter={v => fmt(v)}
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                  <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: 11 }} />
                  <Bar dataKey="Base" fill="var(--text-muted)" radius={[3,3,0,0]} />
                  <Bar dataKey="Simulated" fill="var(--accent)" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Ripple effects */}
          <div className="twin-ripples">
            <h4>Ripple Effects</h4>
            {ripples.length === 0 ? (
              <p className="twin-no-ripples">Adjust sliders or pick a scenario to see how changes cascade through your finances.</p>
            ) : (
              <div className="twin-ripple-list">
                {ripples.map((r, i) => (
                  <div key={i} className={`twin-ripple twin-ripple--${r.isPos ? 'pos' : 'neg'}`}>
                    <span className="twin-ripple-label">{r.label}</span>
                    <span className="twin-ripple-value">
                      {r.isPct ? pct(r.value) : r.isRaw ? '' : fmt(r.value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
