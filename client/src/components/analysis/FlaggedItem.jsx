import { AlertTriangle, DollarSign, ChevronRight } from 'lucide-react';
import RiskBadge from './RiskBadge';

const flagTypeLabels = {
  duplicate_charge: 'Duplicate Charge',
  price_increase: 'Price Increase',
  hidden_fee: 'Hidden Fee',
  overcharge: 'Overcharge',
  subscription_trap: 'Subscription Trap',
  billing_error: 'Billing Error',
  suspicious: 'Suspicious Activity',
};

export default function FlaggedItem({ flag, onClick }) {
  return (
    <div className={`flagged-item flagged-item--${flag.severity}`} onClick={() => onClick?.(flag)}>
      <div className="flagged-item-header">
        <AlertTriangle size={18} />
        <span className="flagged-item-type">{flagTypeLabels[flag.flag_type] || flag.flag_type}</span>
        <RiskBadge severity={flag.severity} />
      </div>
      <p className="flagged-item-desc">{flag.description}</p>
      <div className="flagged-item-footer">
        <span className="flagged-item-savings">
          <DollarSign size={14} />
          ${flag.estimated_savings?.toFixed(2)} potential savings
        </span>
        <span className="flagged-item-confidence">
          {Math.round((flag.confidence || 0) * 100)}% confidence
        </span>
        <ChevronRight size={16} />
      </div>
    </div>
  );
}
