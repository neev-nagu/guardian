import { useState, useEffect } from 'react';
import { FileText, AlertTriangle, ShieldCheck } from 'lucide-react';
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
        <FileText size={26} />
        <div>
          <span className="summary-value">{docs.length}</span>
          <span className="summary-label">Documents Scanned</span>
        </div>
      </div>
      <div className="summary-card summary-card--warning">
        <AlertTriangle size={26} />
        <div>
          <span className="summary-value">{stats.totalFlags}</span>
          <span className="summary-label">Issues Found</span>
        </div>
      </div>
      <div className="summary-card summary-card--success">
        <ShieldCheck size={26} />
        <div>
          <span className="summary-value">{stats.mlFraudDetections ?? 0}</span>
          <span className="summary-label">ML Fraud Detections</span>
        </div>
      </div>
    </div>
  );
}
