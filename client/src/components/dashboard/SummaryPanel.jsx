import { useState, useEffect } from 'react';
import { FileText, AlertTriangle, DollarSign, ShieldCheck } from 'lucide-react';
import CountUp from 'react-countup';
import { api } from '../../api/client';

export default function SummaryPanel() {
  const [stats, setStats] = useState(null);
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    api.getSummaryStats().then(setStats).catch(() => {});
    api.getDocuments().then(setDocs).catch(() => {});
  }, []);

  if (!stats) return null;

  return (
    <div className="summary-panel">
      <div className="summary-card">
        <FileText size={28} />
        <div>
          <span className="summary-value">{docs.length}</span>
          <span className="summary-label">Documents Scanned</span>
        </div>
      </div>
      <div className="summary-card summary-card--warning">
        <AlertTriangle size={28} />
        <div>
          <span className="summary-value">{stats.totalFlags}</span>
          <span className="summary-label">Issues Found</span>
        </div>
      </div>
      <div className="summary-card summary-card--danger">
        <DollarSign size={28} />
        <div>
          <span className="summary-value">
            $<CountUp end={stats.estimatedSavings} decimals={2} duration={1.5} preserveValue />
          </span>
          <span className="summary-label">Potential Savings</span>
        </div>
      </div>
      <div className="summary-card summary-card--success">
        <ShieldCheck size={28} />
        <div>
          <span className="summary-value">
            $<CountUp end={stats.resolvedSavings} decimals={2} duration={1.5} preserveValue />
          </span>
          <span className="summary-label">Recovered</span>
        </div>
      </div>
    </div>
  );
}
