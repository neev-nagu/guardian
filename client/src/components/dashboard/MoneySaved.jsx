import { useState, useEffect } from 'react';
import CountUp from 'react-countup';
import { DollarSign } from 'lucide-react';
import { api } from '../../api/client';

export default function MoneySaved() {
  const [savings, setSavings] = useState({ totalSaved: 0, estimatedSavings: 0 });

  useEffect(() => {
    const fetchSavings = () => api.getSavings().then(setSavings).catch(() => {});
    fetchSavings();
    const interval = setInterval(fetchSavings, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="money-saved">
      <DollarSign size={18} />
      <div className="money-saved-content">
        <span className="money-saved-label">Money Saved</span>
        <span className="money-saved-amount">
          $<CountUp end={savings.totalSaved} decimals={2} duration={1.5} preserveValue />
        </span>
      </div>
      {savings.estimatedSavings > 0 && (
        <span className="money-saved-estimated">
          ${savings.estimatedSavings.toFixed(2)} potential
        </span>
      )}
    </div>
  );
}
