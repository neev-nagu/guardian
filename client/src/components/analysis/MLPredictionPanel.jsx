import { Brain, ShieldAlert, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export default function MLPredictionPanel({ mlPrediction }) {
  const [expanded, setExpanded] = useState(false);

  if (!mlPrediction) return null;

  const { is_fraud, probability, gemini_explanation, error } = mlPrediction;
  const pct = Math.round((probability || 0) * 100);
  const isFraud = !!is_fraud;

  return (
    <div className={`ml-panel ml-panel--${isFraud ? 'fraud' : 'clean'}`}>
      <div className="ml-panel-header" onClick={() => setExpanded(e => !e)}>
        <div className="ml-panel-title">
          <Brain size={20} />
          <span>Random Forest Model</span>
          {isFraud
            ? <span className="ml-badge ml-badge--fraud"><ShieldAlert size={14} /> FRAUD DETECTED</span>
            : <span className="ml-badge ml-badge--clean"><ShieldCheck size={14} /> CLEAN</span>
          }
        </div>
        <div className="ml-panel-prob">
          <div className="ml-prob-bar">
            <div
              className="ml-prob-fill"
              style={{
                width: `${pct}%`,
                background: isFraud
                  ? `hsl(${Math.max(0, 10 - pct / 5)}, 90%, 45%)`
                  : `hsl(145, 70%, 40%)`
              }}
            />
          </div>
          <span className="ml-prob-label">{pct}% fraud probability</span>
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {expanded && (
        <div className="ml-panel-body">
          {error && <p className="ml-error">Model error: {error}</p>}

          {gemini_explanation && (
            <div className="ml-explanation">
              <h4>AI Fraud Explanation</h4>
              <p className="ml-explanation-summary">{gemini_explanation.summary}</p>

              {gemini_explanation.risk_factors?.length > 0 && (
                <div className="ml-explanation-section">
                  <strong>Risk Factors</strong>
                  <ul>
                    {gemini_explanation.risk_factors.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}

              {gemini_explanation.recommended_actions?.length > 0 && (
                <div className="ml-explanation-section">
                  <strong>Recommended Actions</strong>
                  <ul>
                    {gemini_explanation.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}

              {gemini_explanation.confidence_explanation && (
                <p className="ml-conf-explain">
                  <em>{gemini_explanation.confidence_explanation}</em>
                </p>
              )}
            </div>
          )}

          {!gemini_explanation && !error && (
            <p className="ml-no-explanation">
              {isFraud
                ? 'AI explanation was not generated for this prediction.'
                : 'No fraud indicators detected by the model.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
