import { useState, useEffect } from 'react';
import { api } from '../../api/client';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function riskColor(score) {
  if (score === 0) return '#e0f2fe';
  if (score < 0.25) return '#86efac';
  if (score < 0.5)  return '#fde68a';
  if (score < 0.75) return '#fb923c';
  return '#ef4444';
}

function riskLabel(score) {
  if (score === 0) return 'No activity';
  if (score < 0.25) return 'Low risk';
  if (score < 0.5) return 'Moderate risk';
  if (score < 0.75) return 'High risk';
  return 'Critical risk';
}

export default function RiskHeatmap() {
  const [data, setData] = useState([]);
  const [tooltip, setTooltip] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getHeatmap()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Build a full 52-week grid ending today
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 364);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // align to Sunday

  const dataMap = {};
  data.forEach(d => { dataMap[d.date] = d; });

  const weeks = [];
  let cur = new Date(startDate);
  while (cur <= today) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      if (cur <= today) {
        const dateStr = cur.toISOString().split('T')[0];
        week.push({ date: dateStr, day: cur.getDay(), month: cur.getMonth(), dom: cur.getDate(), ...dataMap[dateStr] });
      } else {
        week.push(null);
      }
      cur = new Date(cur);
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  const monthLabels = [];
  weeks.forEach((week, wi) => {
    const first = week.find(d => d && d.dom <= 7);
    if (first) monthLabels.push({ wi, label: MONTHS[first.month] });
  });

  if (loading) return <div className="heatmap-loading">Loading risk heatmap...</div>;

  return (
    <div className="risk-heatmap">
      <div className="heatmap-header">
        <h3>Risk Heatmap</h3>
        <div className="heatmap-legend">
          <span>Low</span>
          {[0, 0.2, 0.45, 0.65, 0.85].map(s => (
            <div key={s} className="heatmap-legend-cell" style={{ background: riskColor(s) }} />
          ))}
          <span>Critical</span>
        </div>
      </div>

      <div className="heatmap-grid-wrap">
        <div className="heatmap-day-labels">
          {DAYS.map((d, i) => (
            <span key={d} style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}>{d}</span>
          ))}
        </div>

        <div className="heatmap-grid-inner">
          <div className="heatmap-month-labels">
            {monthLabels.map(({ wi, label }) => (
              <span key={wi} style={{ gridColumnStart: wi + 1 }}>{label}</span>
            ))}
          </div>

          <div className="heatmap-cells">
            {weeks.map((week, wi) => (
              <div key={wi} className="heatmap-week">
                {week.map((cell, di) => cell ? (
                  <div
                    key={di}
                    className="heatmap-cell"
                    style={{ background: riskColor(cell.risk_score || 0) }}
                    onMouseEnter={e => setTooltip({ cell, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setTooltip(null)}
                  />
                ) : (
                  <div key={di} className="heatmap-cell heatmap-cell--empty" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {tooltip && (
        <div className="heatmap-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y - 60 }}>
          <strong>{tooltip.cell.date}</strong>
          <span>{riskLabel(tooltip.cell.risk_score || 0)} ({Math.round((tooltip.cell.risk_score || 0) * 100)}%)</span>
          {tooltip.cell.doc_count > 0 && <span>{tooltip.cell.doc_count} doc{tooltip.cell.doc_count > 1 ? 's' : ''}</span>}
          {tooltip.cell.flag_count > 0 && <span>{tooltip.cell.flag_count} flag{tooltip.cell.flag_count > 1 ? 's' : ''}</span>}
          {tooltip.cell.ml_fraud_count > 0 && <span>{tooltip.cell.ml_fraud_count} ML fraud</span>}
        </div>
      )}
    </div>
  );
}
