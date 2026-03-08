import { useState } from 'react';
import { Copy, Check, RefreshCw, Mail, FileText, Phone } from 'lucide-react';
import { api } from '../../api/client';

const typeIcons = { email: Mail, letter: FileText, phone_script: Phone };
const typeLabels = { email: 'Email', letter: 'Letter', phone_script: 'Phone Script' };

export default function NegotiationMessage({ flag }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [messageType, setMessageType] = useState('email');
  const [tone, setTone] = useState('firm');

  const generate = async () => {
    setLoading(true);
    try {
      const result = await api.generateNegotiation({ flagId: flag.id, messageType, tone });
      setMessage(result.message);
    } catch (err) {
      setMessage('Failed to generate message. Please try again.');
    }
    setLoading(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="negotiation-message">
      <div className="negotiation-controls">
        <div className="negotiation-types">
          {Object.entries(typeLabels).map(([type, label]) => {
            const Icon = typeIcons[type];
            return (
              <button
                key={type}
                className={`neg-type-btn ${messageType === type ? 'neg-type-btn--active' : ''}`}
                onClick={() => setMessageType(type)}
              >
                <Icon size={14} /> {label}
              </button>
            );
          })}
        </div>
        <div className="negotiation-tones">
          {['polite', 'firm', 'aggressive'].map(t => (
            <button
              key={t}
              className={`neg-tone-btn ${tone === t ? 'neg-tone-btn--active' : ''}`}
              onClick={() => setTone(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <button className="generate-btn" onClick={generate} disabled={loading}>
        {loading ? <><RefreshCw size={16} className="spinner" /> Generating...</> : 'Generate Dispute Message'}
      </button>

      {message && (
        <div className="negotiation-result">
          <pre className="negotiation-text">{message}</pre>
          <button className="copy-btn" onClick={copyToClipboard}>
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy to Clipboard</>}
          </button>
        </div>
      )}
    </div>
  );
}
