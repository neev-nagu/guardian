import { useState, useEffect } from 'react';
import { ShieldAlert, DollarSign, AlertTriangle } from 'lucide-react';
import { api } from '../../api/client';
import FlaggedItem from './FlaggedItem';

export default function FraudDashboard({ documentId, onSelectFlag, flags: externalFlags }) {
  const [flags, setFlags] = useState(externalFlags || []);
  const [loading, setLoading] = useState(!externalFlags);

  useEffect(() => {
    if (externalFlags) {
      setFlags(externalFlags);
      return;
    }
    if (!documentId) return;
    api.getFlags(documentId).then(setFlags).catch(() => {}).finally(() => setLoading(false));
  }, [documentId, externalFlags]);

  const totalSavings = flags.reduce((sum, f) => sum + (f.estimated_savings || 0), 0);
  const highCount = flags.filter(f => f.severity === 'high').length;

  if (loading) {
    return <div className="fraud-dashboard-loading">Analyzing for issues...</div>;
  }

  if (flags.length === 0) {
    return (
      <div className="fraud-dashboard-clean">
        <ShieldAlert size={48} />
        <h3>No issues detected</h3>
        <p>This document looks clean. No suspicious charges found.</p>
      </div>
    );
  }

  return (
    <div className="fraud-dashboard">
      <div className="fraud-dashboard-summary">
        <div className="fraud-stat">
          <AlertTriangle size={24} />
          <div>
            <span className="fraud-stat-value">{flags.length}</span>
            <span className="fraud-stat-label">Issues Found</span>
          </div>
        </div>
        <div className="fraud-stat fraud-stat--savings">
          <DollarSign size={24} />
          <div>
            <span className="fraud-stat-value">${totalSavings.toFixed(2)}</span>
            <span className="fraud-stat-label">Potential Savings</span>
          </div>
        </div>
        {highCount > 0 && (
          <div className="fraud-stat fraud-stat--critical">
            <ShieldAlert size={24} />
            <div>
              <span className="fraud-stat-value">{highCount}</span>
              <span className="fraud-stat-label">Critical</span>
            </div>
          </div>
        )}
      </div>
      <div className="fraud-flags-list">
        {flags.map(flag => (
          <FlaggedItem key={flag.id} flag={flag} onClick={onSelectFlag} />
        ))}
      </div>
    </div>
  );
}
