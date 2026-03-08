import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, BarChart2, Loader, RefreshCw } from 'lucide-react';
import { api } from '../api/client';

function StatCard({ label, value, positive }) {
  const color = value === 0 ? '' : positive ? 'positive' : 'negative';
  return (
    <div className={`fin-stat-card fin-stat-card--${color}`}>
      <span className="fin-stat-label">{label}</span>
      <span className="fin-stat-value">
        {value >= 0 ? '' : '-'}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
}

function IncomeStatement({ data }) {
  if (!data) return null;
  const rows = [
    { label: 'Revenue', value: data.revenue, positive: true },
    { label: 'Cost of Goods Sold', value: -data.cost_of_goods_sold, positive: false },
    { label: 'Gross Profit', value: data.gross_profit, positive: data.gross_profit >= 0, bold: true },
    { label: 'Operating Expenses', value: -data.operating_expenses, positive: false },
    { label: 'Operating Income', value: data.operating_income, positive: data.operating_income >= 0, bold: true },
    { label: 'Taxes', value: -data.taxes, positive: false },
    { label: 'Net Income', value: data.net_income, positive: data.net_income >= 0, bold: true, highlight: true },
  ];

  return (
    <div className="fin-statement">
      <h3 className="fin-statement-title">
        <TrendingUp size={18} /> Income Statement
        <span className="fin-period">{data.period}</span>
      </h3>
      <table className="fin-table">
        <tbody>
          {rows.map(row => (
            <tr key={row.label} className={`fin-row ${row.bold ? 'fin-row--bold' : ''} ${row.highlight ? 'fin-row--highlight' : ''}`}>
              <td>{row.label}</td>
              <td className={`fin-amount ${row.value >= 0 ? 'pos' : 'neg'}`}>
                {row.value < 0 ? '-' : ''}${Math.abs(row.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="fin-margins">
        <span>Gross Margin: <strong>{data.gross_margin_pct}%</strong></span>
        <span>Net Margin: <strong>{data.net_margin_pct}%</strong></span>
      </div>
    </div>
  );
}

function fmt(n) {
  const abs = Math.abs(n || 0);
  const sign = (n || 0) < 0 ? '-' : '';
  return sign + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function BalanceSheet({ data }) {
  if (!data) return null;
  const ca     = data.assets?.current_assets;
  const cl     = data.liabilities?.current_liabilities;
  const equity = data.equity;

  const totalAssets = data.assets?.total_assets || 0;
  const totalLE     = data.total_liabilities_and_equity || 0;
  const balanced    = Math.abs(totalAssets - totalLE) < 0.01;

  return (
    <div className="fin-statement">
      <h3 className="fin-statement-title">
        <BarChart2 size={18} /> Balance Sheet
        <span className="fin-period">As of {data.as_of}</span>
        <span className={`fin-balance-badge ${balanced ? 'balanced' : 'unbalanced'}`}>
          {balanced ? '✓ Balanced' : '✗ Out of Balance'}
        </span>
      </h3>
      <div className="fin-balance-grid">
        {/* LEFT: Assets */}
        <div className="fin-balance-col">
          <h4>Assets</h4>
          <table className="fin-table">
            <tbody>
              <tr>
                <td>Cash from Revenue</td>
                <td className="fin-amount pos">{fmt(ca?.cash_from_revenue)}</td>
              </tr>
              <tr>
                <td>Owner Capital Deployed</td>
                <td className="fin-amount pos">{fmt(ca?.owner_capital_deployed)}</td>
              </tr>
              <tr className="fin-row--bold fin-row--highlight">
                <td>Total Assets</td>
                <td className="fin-amount pos">{fmt(totalAssets)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* RIGHT: Liabilities + Equity */}
        <div className="fin-balance-col">
          <h4>Liabilities</h4>
          <table className="fin-table">
            <tbody>
              <tr>
                <td>Accounts Payable</td>
                <td className="fin-amount neg">{fmt(cl?.accounts_payable)}</td>
              </tr>
              <tr className="fin-row--bold">
                <td>Total Liabilities</td>
                <td className="fin-amount neg">{fmt(data.liabilities?.total_liabilities)}</td>
              </tr>
            </tbody>
          </table>

          <h4 style={{marginTop:'1rem'}}>Equity</h4>
          <table className="fin-table">
            <tbody>
              <tr>
                <td>Paid-in Capital</td>
                <td className="fin-amount pos">{fmt(equity?.paid_in_capital)}</td>
              </tr>
              <tr>
                <td>Retained Earnings</td>
                <td className={`fin-amount ${(equity?.retained_earnings || 0) >= 0 ? 'pos' : 'neg'}`}>
                  {fmt(equity?.retained_earnings)}
                </td>
              </tr>
              <tr className="fin-row--bold">
                <td>Total Equity</td>
                <td className={`fin-amount ${(equity?.total_equity || 0) >= 0 ? 'pos' : 'neg'}`}>
                  {fmt(equity?.total_equity)}
                </td>
              </tr>
              <tr className="fin-row--bold fin-row--highlight">
                <td>Total Liabilities + Equity</td>
                <td className="fin-amount pos">{fmt(totalLE)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {data.expense_breakdown_by_category && Object.keys(data.expense_breakdown_by_category).length > 0 && (
        <div className="fin-breakdown">
          <h4>Expense Breakdown by Category</h4>
          <div className="fin-breakdown-bars">
            {(() => {
              const entries = Object.entries(data.expense_breakdown_by_category).sort((a, b) => b[1] - a[1]);
              const max = entries[0]?.[1] || 1;
              return entries.map(([cat, amt]) => (
                <div key={cat} className="fin-breakdown-row">
                  <span className="fin-breakdown-label">{cat}</span>
                  <div className="fin-breakdown-bar-wrap">
                    <div className="fin-breakdown-bar" style={{ width: `${(amt / max) * 100}%` }} />
                  </div>
                  <span className="fin-breakdown-amount">${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function CashFlowStatement({ data }) {
  if (!data) return null;
  const { periods, summary } = data;

  return (
    <div className="fin-statement">
      <h3 className="fin-statement-title">
        <DollarSign size={18} /> Cash Flow Statement
      </h3>
      <div className="fin-cashflow-summary">
        <div className="fin-cf-stat">
          <span>Total Inflows</span>
          <strong className="pos">${(summary?.total_inflows || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
        </div>
        <div className="fin-cf-stat">
          <span>Total Outflows</span>
          <strong className="neg">${(summary?.total_outflows || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
        </div>
        <div className="fin-cf-stat">
          <span>Net Position</span>
          <strong className={(summary?.net_cash_position || 0) >= 0 ? 'pos' : 'neg'}>
            {(summary?.net_cash_position || 0) < 0 ? '-' : ''}${Math.abs(summary?.net_cash_position || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </strong>
        </div>
      </div>

      {periods && periods.length > 0 && (
        <table className="fin-table fin-cashflow-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Inflows</th>
              <th>Outflows</th>
              <th>Net</th>
              <th>Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {periods.map(p => (
              <tr key={p.period} className={p.net_cash_flow < 0 ? 'fin-row--neg' : ''}>
                <td>{p.period}</td>
                <td className="fin-amount pos">${p.operating_inflows.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td className="fin-amount neg">${p.operating_outflows.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td className={`fin-amount ${p.net_cash_flow >= 0 ? 'pos' : 'neg'}`}>
                  {p.net_cash_flow < 0 ? '-' : ''}${Math.abs(p.net_cash_flow).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className={`fin-amount ${p.cumulative_cash >= 0 ? 'pos' : 'neg'}`}>
                  {p.cumulative_cash < 0 ? '-' : ''}${Math.abs(p.cumulative_cash).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function FinancialStatementsPage() {
  const [statements, setStatements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [error, setError] = useState(null);

  const load = (y, m) => {
    setLoading(true);
    setError(null);
    api.getFinancialStatements(y || undefined, m || undefined)
      .then(setStatements)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { v: '1', l: 'January' }, { v: '2', l: 'February' }, { v: '3', l: 'March' },
    { v: '4', l: 'April' }, { v: '5', l: 'May' }, { v: '6', l: 'June' },
    { v: '7', l: 'July' }, { v: '8', l: 'August' }, { v: '9', l: 'September' },
    { v: '10', l: 'October' }, { v: '11', l: 'November' }, { v: '12', l: 'December' },
  ];

  return (
    <div className="fin-page">
      <div className="fin-page-header">
        <h1><TrendingUp size={28} /> Financial Statements</h1>
        <p className="fin-page-sub">Generated from all tracked invoices and receipts</p>
      </div>

      {/* Period Filter */}
      <div className="fin-filters">
        <select value={year} onChange={e => setYear(e.target.value)}>
          <option value="">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(e.target.value)} disabled={!year}>
          <option value="">All Months</option>
          {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
        </select>
        <button className="fin-filter-btn" onClick={() => load(year, month)}>
          <RefreshCw size={14} /> Generate
        </button>
      </div>

      {loading && (
        <div className="fin-loading">
          <Loader size={32} className="spinner" /> Generating financial statements...
        </div>
      )}

      {error && <div className="fin-error">{error}</div>}

      {statements && !loading && (
        <>
          <div className="fin-meta">
            Generated {new Date(statements.generated_at).toLocaleString()} •{' '}
            {statements.transaction_count} transactions •{' '}
            Period: <strong>{statements.period}</strong>
          </div>

          <div className="fin-statements-grid">
            <IncomeStatement data={statements.income_statement} />
            <BalanceSheet data={statements.balance_sheet} />
            <CashFlowStatement data={statements.cash_flow_statement} />
          </div>
        </>
      )}
    </div>
  );
}
