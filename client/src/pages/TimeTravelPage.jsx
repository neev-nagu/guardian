import { useState, useEffect, useMemo } from 'react'
import { Clock, TrendingUp, TrendingDown, Loader, ChevronLeft, ChevronRight, DollarSign, ChevronDown, ChevronUp, Save } from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine
} from 'recharts'
import { api } from '../api/client'

// key used to persist revenue overrides across sessions
const STORAGE_KEY = 'papaya_revenue_overrides'

// formats a dollar amount without decimals
function fmt(n) {
  return '$' + Math.abs(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// load and save helpers for localStorage
function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}
function saveOverrides(v) { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)) }

// custom tooltip that labels forecast points differently
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const isForecast = payload[0]?.payload?.is_forecast
  return (
    <div className="tt-tooltip">
      <div className="tt-tooltip-header">
        {label} {isForecast && <span className="tt-forecast-badge">Forecast</span>}
      </div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </div>
      ))}
    </div>
  )
}

// basic linear regression to project revenue and expenses forward
function linearForecast(data, months) {
  if (data.length < 2) return []
  const n = data.length
  const xMean = (n - 1) / 2
  const revMean = data.reduce((s, d) => s + d.revenue, 0) / n
  const expMean = data.reduce((s, d) => s + d.expenses, 0) / n

  // compute slopes for revenue and expenses independently
  let revNum = 0, expNum = 0, den = 0
  data.forEach((d, i) => {
    revNum += (i - xMean) * (d.revenue - revMean)
    expNum += (i - xMean) * (d.expenses - expMean)
    den += (i - xMean) ** 2
  })
  const revSlope = den ? revNum / den : 0
  const expSlope = den ? expNum / den : 0
  const revIntercept = revMean - revSlope * xMean
  const expIntercept = expMean - expSlope * xMean

  // step forward month by month from the last known data point
  const lastMonth = data[data.length - 1].month
  const [yr, mo] = lastMonth.split('-').map(Number)
  const result = []
  for (let i = 1; i <= months; i++) {
    const moOffset = mo - 1 + i
    const year = yr + Math.floor(moOffset / 12)
    const month = (moOffset % 12) + 1
    const label = `${year}-${String(month).padStart(2, '0')}`
    const x = n - 1 + i
    const revenue = Math.max(0, revIntercept + revSlope * x)
    const expenses = Math.max(0, expIntercept + expSlope * x)
    result.push({ month: label, revenue, expenses, net: revenue - expenses, is_forecast: true })
  }
  return result
}

export default function TimeTravelPage() {
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [forecastMonths, setForecastMonths] = useState(6)
  const [view, setView] = useState('both')
  const [showRevenuePanel, setShowRevenuePanel] = useState(false)

  // revenue overrides: global applies to months with zero revenue, per-month take priority
  const [overrides, setOverrides] = useState(loadOverrides)
  const [globalInput, setGlobalInput] = useState(loadOverrides().global?.toString() || '')
  const [dirty, setDirty] = useState(false)

  // fetch historical timeline from the server on mount
  useEffect(() => {
    api.getTimeline()
      .then(hist => setTimeline(hist))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // apply revenue overrides to the raw timeline data
  const mergedTimeline = useMemo(() => {
    const global = overrides.global || 0
    return timeline.map(row => {
      const monthOverride = overrides[row.month]
      let revenue = row.revenue
      if (monthOverride !== undefined) revenue = monthOverride
      else if (revenue === 0 && global > 0) revenue = global
      const net = revenue - row.expenses
      return { ...row, revenue, net }
    })
  }, [timeline, overrides])

  // run forecast on the merged data so manual revenue is included
  const forecast = useMemo(() => {
    if (mergedTimeline.length === 0) return []
    return linearForecast(mergedTimeline, forecastMonths)
  }, [mergedTimeline, forecastMonths])

  // combine historical and forecast into one chart dataset
  const chartData = [
    ...mergedTimeline.map(d => ({ ...d, is_forecast: false })),
    ...forecast,
  ]

  // filter chart data based on which view is selected
  const visibleData = view === 'past' ? mergedTimeline.map(d => ({ ...d, is_forecast: false }))
    : view === 'future' ? forecast
    : chartData

  // summary stats for the header cards
  const totalRevenue = mergedTimeline.reduce((s, d) => s + d.revenue, 0)
  const totalExpenses = mergedTimeline.reduce((s, d) => s + d.expenses, 0)
  const avgMonthlyNet = mergedTimeline.length ? (totalRevenue - totalExpenses) / mergedTimeline.length : 0
  const forecastRevenue = forecast.reduce((s, d) => s + d.revenue, 0)
  const forecastExpenses = forecast.reduce((s, d) => s + d.expenses, 0)

  // the last real month used as the divider line on the chart
  const divider = mergedTimeline[mergedTimeline.length - 1]?.month

  // persist the global revenue setting
  function saveRevenueSettings() {
    const val = parseFloat(globalInput)
    const next = { ...overrides, global: isNaN(val) ? 0 : val }
    setOverrides(next)
    saveOverrides(next)
    setDirty(false)
  }

  // update a single month override and save immediately
  function setMonthOverride(month, val) {
    const parsed = val === '' ? undefined : parseFloat(val)
    const next = { ...overrides }
    if (parsed === undefined || isNaN(parsed)) delete next[month]
    else next[month] = parsed
    setOverrides(next)
    saveOverrides(next)
  }

  // dot indicator shows if any revenue config is active
  const hasRevenueConfig = overrides.global > 0 || Object.keys(overrides).some(k => k !== 'global')

  return (
    <div className="tt-page">
      <div className="tt-page-header">
        <h1><Clock size={28} /> Time Travel Accountant</h1>
        <p className="tt-sub">Audit your past and predict your future. Revenue inputs help when your data is mostly invoices.</p>
      </div>

      {/* collapsible panel to set manual revenue numbers */}
      <div className="tt-revenue-panel">
        <button className="tt-revenue-toggle" onClick={() => setShowRevenuePanel(s => !s)}>
          <DollarSign size={16} />
          <span>Revenue Configuration {hasRevenueConfig && <span className="tt-rev-dot" />}</span>
          {showRevenuePanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showRevenuePanel && (
          <div className="tt-revenue-body">
            <p className="tt-revenue-hint">
              Set a monthly recurring revenue if your uploads are mostly invoices/expenses.
              Applied to months where revenue is $0. Per-month overrides take priority.
            </p>
            <div className="tt-rev-global">
              <label>Monthly Recurring Revenue</label>
              <div className="tt-rev-input-row">
                <span className="tt-rev-prefix">$</span>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 15000"
                  value={globalInput}
                  onChange={e => { setGlobalInput(e.target.value); setDirty(true) }}
                  className="tt-rev-input"
                />
                <button className="tt-rev-save" onClick={saveRevenueSettings}>
                  <Save size={13} /> Apply
                </button>
              </div>
            </div>

            {/* per-month overrides grid */}
            {timeline.length > 0 && (
              <div className="tt-rev-months">
                <label className="tt-rev-month-label">Per-Month Overrides (optional)</label>
                <div className="tt-rev-month-grid">
                  {timeline.map(row => (
                    <div key={row.month} className="tt-rev-month-row">
                      <span>{row.month}</span>
                      <div className="tt-rev-input-row">
                        <span className="tt-rev-prefix">$</span>
                        <input
                          type="number"
                          min="0"
                          placeholder={`DB: ${fmt(row.revenue)}`}
                          value={overrides[row.month] !== undefined ? overrides[row.month] : ''}
                          onChange={e => setMonthOverride(row.month, e.target.value)}
                          className="tt-rev-input tt-rev-input--sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* summary stat cards */}
      <div className="tt-stats">
        <div className="tt-stat">
          <span className="tt-stat-label">Historical Revenue</span>
          <span className="tt-stat-value pos">{fmt(totalRevenue)}</span>
          <span className="tt-stat-sub">{mergedTimeline.length} months of data</span>
        </div>
        <div className="tt-stat">
          <span className="tt-stat-label">Historical Expenses</span>
          <span className="tt-stat-value neg">{fmt(totalExpenses)}</span>
        </div>
        <div className="tt-stat">
          <span className="tt-stat-label">Avg Monthly Net</span>
          <span className={`tt-stat-value ${avgMonthlyNet >= 0 ? 'pos' : 'neg'}`}>{fmt(avgMonthlyNet)}</span>
        </div>
        <div className="tt-stat tt-stat--forecast">
          <span className="tt-stat-label">Forecast Revenue ({forecastMonths}mo)</span>
          <span className="tt-stat-value pos">{fmt(forecastRevenue)}</span>
        </div>
        <div className="tt-stat tt-stat--forecast">
          <span className="tt-stat-label">Forecast Expenses ({forecastMonths}mo)</span>
          <span className="tt-stat-value neg">{fmt(forecastExpenses)}</span>
        </div>
        <div className="tt-stat tt-stat--forecast">
          <span className="tt-stat-label">Forecast Net ({forecastMonths}mo)</span>
          <span className={`tt-stat-value ${forecastRevenue - forecastExpenses >= 0 ? 'pos' : 'neg'}`}>
            {fmt(forecastRevenue - forecastExpenses)}
          </span>
        </div>
      </div>

      {/* view toggle and forecast horizon controls */}
      <div className="tt-controls">
        <div className="tt-view-toggle">
          {['past', 'both', 'future'].map(v => (
            <button key={v} className={`tt-toggle-btn ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
              {v === 'past' ? 'Past' : v === 'future' ? 'Future' : 'Full Timeline'}
            </button>
          ))}
        </div>

        <div className="tt-forecast-control">
          <label>Forecast horizon:</label>
          <button onClick={() => setForecastMonths(m => Math.max(1, m - 1))}>
            <ChevronLeft size={14} />
          </button>
          <span>{forecastMonths} months</span>
          <button onClick={() => setForecastMonths(m => Math.min(24, m + 1))}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="tt-loading"><Loader size={28} className="spinner" /> Building timeline...</div>
      ) : visibleData.length === 0 ? (
        <div className="tt-empty">Upload and analyze documents to build your financial timeline.</div>
      ) : (
        <div className="tt-chart-wrap">
          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart data={visibleData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => '$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: 12 }} />

              {/* dashed line marking where historical ends and forecast begins */}
              {divider && view === 'both' && (
                <ReferenceLine x={divider} stroke="var(--accent)" strokeDasharray="4 4" label={{ value: 'Today', fill: 'var(--accent)', fontSize: 11 }} />
              )}

              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#16a34a" fill="url(#revGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#dc2626" fill="url(#expGrad)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="net" name="Net" stroke="var(--accent)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>

          {forecast.length > 0 && view !== 'past' && (
            <div className="tt-forecast-note">
              <span>Shaded area after {divider} = linear regression forecast</span>
              {hasRevenueConfig && <span>Revenue from manual inputs</span>}
            </div>
          )}
        </div>
      )}

      {/* monthly breakdown table */}
      {!loading && visibleData.length > 0 && (
        <div className="tt-table-wrap">
          <table className="tt-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Revenue</th>
                <th>Expenses</th>
                <th>Net</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {visibleData.map(row => (
                <tr key={row.month} className={row.is_forecast ? 'tt-row--forecast' : ''}>
                  <td>{row.month}</td>
                  <td className="pos">{fmt(row.revenue)}</td>
                  <td className="neg">{fmt(row.expenses)}</td>
                  <td className={row.net >= 0 ? 'pos' : 'neg'}>{fmt(row.net)}</td>
                  <td>{row.is_forecast
                    ? <span className="tt-forecast-badge">Forecast</span>
                    : <span className="tt-actual-badge">Actual</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
