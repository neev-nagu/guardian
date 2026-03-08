import { Bot, Users } from 'lucide-react';

export default function ActionChoice({ onChooseAI, onChooseTerac }) {
  return (
    <div className="action-choice">
      <h3>How would you like to resolve this?</h3>
      <div className="action-choice-buttons">
        <button className="action-btn action-btn--ai" onClick={onChooseAI}>
          <Bot size={24} />
          <span className="action-btn-title">AI Dispute</span>
          <span className="action-btn-desc">Generate a dispute message instantly</span>
        </button>
        <button className="action-btn action-btn--terac" onClick={onChooseTerac}>
          <Users size={24} />
          <span className="action-btn-title">Talk to Advisor</span>
          <span className="action-btn-desc">Connect with a financial expert via Terac</span>
        </button>
      </div>
    </div>
  );
}
