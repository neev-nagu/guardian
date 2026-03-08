import { CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import { useState } from 'react';

const CHECK_LABELS = {
  math_totals: 'Math / Totals',
  duplicate_line_items: 'Duplicate Items',
  round_numbers: 'Round Numbers',
  split_invoice: 'Split Invoice',
  vendor_anomaly: 'Vendor Names',
};

const EXCLUDED_CHECKS = new Set(['late_night_submission', 'benford_law']);

function SeverityIcon({ severity, passed }) {
  if (passed) return <CheckCircle size={16} className="rule-icon rule-icon--pass" />;
  if (severity === 'high') return <XCircle size={16} className="rule-icon rule-icon--high" />;
  return <AlertCircle size={16} className="rule-icon rule-icon--warn" />;
}

export default function RuleChecksPanel({ ruleChecks }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedCheck, setExpandedCheck] = useState(null);

  if (!ruleChecks || ruleChecks.length === 0) return null;

  const visibleChecks = ruleChecks.filter(c => {
    const type = c.check || c.check_type;
    return !EXCLUDED_CHECKS.has(type);
  });

  if (visibleChecks.length === 0) return null;

  const failed = visibleChecks.filter(c => !c.passed);
  const allPassed = failed.length === 0;

  return (
    <div className={`rule-panel rule-panel--${allPassed ? 'clean' : 'warn'}`}>
      <div className="rule-panel-header" onClick={() => setExpanded(e => !e)}>
        <div className="rule-panel-title">
          <BarChart2 size={20} />
          <span>Rule-Based Checks</span>
          {allPassed
            ? <span className="rule-badge rule-badge--pass">All Passed</span>
            : <span className="rule-badge rule-badge--fail">{failed.length} Failed</span>
          }
        </div>
        <div className="rule-summary">
          {visibleChecks.map(c => (
            <span
              key={c.check || c.check_type}
              className={`rule-dot rule-dot--${c.passed ? 'pass' : c.severity}`}
              title={CHECK_LABELS[c.check || c.check_type] || (c.check || c.check_type)}
            />
          ))}
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {expanded && (
        <div className="rule-panel-body">
          {visibleChecks.map((check, i) => {
            const type = check.check || check.check_type;
            const extra = check.extra || (check.extra_json ? JSON.parse(check.extra_json) : {});
            const isOpen = expandedCheck === i;

            return (
              <div key={i} className={`rule-check-item rule-check-item--${check.passed ? 'pass' : check.severity}`}>
                <div
                  className="rule-check-header"
                  onClick={() => setExpandedCheck(isOpen ? null : i)}
                >
                  <SeverityIcon severity={check.severity} passed={check.passed} />
                  <span className="rule-check-name">{CHECK_LABELS[type] || type}</span>
                  <span className={`rule-check-badge ${check.passed ? 'pass' : 'fail'}`}>
                    {check.passed ? 'PASS' : 'FAIL'}
                  </span>
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>

                {isOpen && (
                  <div className="rule-check-details">
                    <p>{check.details}</p>

                    {type === 'math_totals' && (
                      <div className="rule-math-detail">
                        {extra.subtotal != null && (
                          <span>Subtotal: <strong>${extra.subtotal?.toFixed(2)}</strong></span>
                        )}
                        {extra.tax != null && (
                          <span>Tax: <strong>${extra.tax?.toFixed(2)}</strong></span>
                        )}
                        {extra.stated_total != null && (
                          <span>Stated total: <strong>${extra.stated_total?.toFixed(2)}</strong></span>
                        )}
                        <span>Line items sum: <strong>${extra.line_sum?.toFixed(2)}</strong></span>
                        {extra.discrepancy > 0.01 && (
                          <span>Discrepancy: <strong className="text-danger">${extra.discrepancy?.toFixed(2)}</strong></span>
                        )}
                        {extra.issues?.length > 0 && (
                          <ul className="rule-dup-list" style={{marginTop:'0.5rem'}}>
                            {extra.issues.map((iss, j) => (
                              <li key={j}>{iss.check.replace(/_/g,' ')}: expected ${iss.expected?.toFixed(2)}, got ${iss.got?.toFixed(2)} (off by ${iss.discrepancy?.toFixed(2)})</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {type === 'duplicate_line_items' && extra.duplicates?.length > 0 && (
                      <ul className="rule-dup-list">
                        {extra.duplicates.map((d, j) => (
                          <li key={j}>"{d.description}" for ${d.amount?.toFixed(2)} (items {d.item1_idx + 1} and {d.item2_idx + 1})</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
