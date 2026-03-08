import { useState, useEffect, useRef } from 'react';
import { Users, Clock, CheckCircle, Loader, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { api } from '../../api/client';

const STATUS_LABELS = {
  pending: 'Setting Up',
  active: 'Active — Experts Working',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function SubmissionCard({ submission }) {
  const [open, setOpen] = useState(false);
  const data = submission.data || {};
  return (
    <div className="terac-submission-card">
      <div className="terac-submission-header" onClick={() => setOpen(o => !o)}>
        <span className="terac-submission-id">Participant {submission.participant_id || submission.id}</span>
        <span className="terac-submission-date">{new Date(submission.created_at).toLocaleString()}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>
      {open && (
        <pre className="terac-submission-json">{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
}

function OpportunityStatus({ opportunity, documentId, flagId }) {
  const [status, setStatus] = useState(opportunity.status);
  const [submissions, setSubmissions] = useState([]);
  const [polling, setPolling] = useState(false);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const intervalRef = useRef(null);

  const pollStatus = async () => {
    try {
      const res = await api.getTeracStatus(opportunity.opportunity_id);
      setStatus(res.status);
      if (res.status === 'active' || res.status === 'completed') {
        fetchSubmissions();
      }
    } catch {}
  };

  const fetchSubmissions = async () => {
    setLoadingSubs(true);
    try {
      const res = await api.getTeracSubmissions(opportunity.opportunity_id);
      setSubmissions(res.submissions || []);
    } catch {}
    setLoadingSubs(false);
  };

  useEffect(() => {
    if (status !== 'completed' && status !== 'cancelled') {
      setPolling(true);
      intervalRef.current = setInterval(pollStatus, 30000);
      pollStatus(); // immediate first check
    }
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (status === 'completed' || status === 'cancelled') {
      clearInterval(intervalRef.current);
      setPolling(false);
    }
  }, [status]);

  return (
    <div className="terac-opportunity">
      <div className="terac-opp-header">
        <div className="terac-opp-name">{opportunity.name}</div>
        <span className={`terac-status-badge terac-status--${status}`}>
          {status === 'active' && <span className="terac-pulse" />}
          {STATUS_LABELS[status] || status}
        </span>
      </div>

      <div className="terac-opp-meta">
        {opportunity.total_cost != null && (
          <span>Cost: <strong>${Number(opportunity.total_cost).toFixed(2)}</strong></span>
        )}
        <span>Submissions requested: <strong>{opportunity.submission_count}</strong></span>
        <span>Timeline: <strong>{opportunity.timeline_hours}h</strong></span>
      </div>

      {polling && (
        <div className="terac-polling">
          <Loader size={14} className="spinner" /> Checking for updates every 30s...
          <button className="terac-refresh-btn" onClick={pollStatus}><RefreshCw size={12} /> Refresh now</button>
        </div>
      )}

      <div className="terac-submissions-section">
        <div className="terac-submissions-header">
          <strong>Submissions ({submissions.length}/{opportunity.submission_count})</strong>
          {(status === 'active' || status === 'completed') && (
            <button className="terac-refresh-btn" onClick={fetchSubmissions} disabled={loadingSubs}>
              {loadingSubs ? <Loader size={12} className="spinner" /> : <RefreshCw size={12} />} Fetch
            </button>
          )}
        </div>
        {submissions.length === 0 ? (
          <p className="terac-no-subs">
            {status === 'pending' ? 'Waiting for opportunity to go live...' : 'No submissions yet.'}
          </p>
        ) : (
          <div className="terac-submission-list">
            {submissions.map(s => <SubmissionCard key={s.id} submission={s} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TeracAdvisor({ flag, documentId }) {
  const [step, setStep] = useState('form'); // form | submitting | opportunity
  const [opportunities, setOpportunities] = useState([]);
  const [activeOpp, setActiveOpp] = useState(null);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    taskDescription: flag
      ? `Review this financial document for the following issue: ${flag.description}. Estimated potential overcharge: $${flag.estimated_savings?.toFixed(2) || '0.00'}.`
      : 'Review financial documents for fraud indicators and billing anomalies.',
    panelDescription: 'Financial analysts, accountants, or billing specialists with experience in expense auditing.',
    timelineHours: 72,
    submissionCount: 3,
    uiLink: '',
    name: flag ? `Review: ${flag.flag_type || 'Financial Issue'}` : 'Financial Document Review',
  });

  // Load existing opportunities for this document
  useEffect(() => {
    if (!documentId) return;
    api.getTeracOpportunities(documentId)
      .then(opps => {
        setOpportunities(opps);
        if (opps.length > 0) setActiveOpp(opps[0]);
      })
      .catch(() => {});
  }, [documentId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStep('submitting');
    setError(null);
    try {
      const result = await api.createTeracOpportunity({
        documentId: documentId || null,
        flagId: flag?.id || null,
        ...form,
        timelineHours: Number(form.timelineHours),
        submissionCount: Number(form.submissionCount),
      });
      const newOpp = {
        opportunity_id: result.opportunityId,
        quote_id: result.quoteId,
        name: form.name,
        status: 'pending',
        total_cost: result.totalCost,
        submission_count: form.submissionCount,
        timeline_hours: form.timelineHours,
      };
      setActiveOpp(newOpp);
      setStep('opportunity');
    } catch (err) {
      setError(err.message);
      setStep('form');
    }
  };

  if (step === 'opportunity' && activeOpp) {
    return (
      <div className="terac-advisor">
        <div className="terac-info">
          <CheckCircle size={28} className="terac-success-icon" />
          <h4>Study Launched</h4>
          <p>Experts are being matched to your research task.</p>
        </div>
        <OpportunityStatus opportunity={activeOpp} documentId={documentId} flagId={flag?.id} />
        <button className="terac-back-btn" onClick={() => setStep('form')}>
          + Launch Another Study
        </button>
      </div>
    );
  }

  return (
    <div className="terac-advisor">
      <div className="terac-info">
        <Users size={32} />
        <h4>Connect with Financial Experts</h4>
        <p>Launch a Terac research study and get real expert analysis on this document.</p>
      </div>

      {/* Previous opportunities */}
      {opportunities.length > 0 && step === 'form' && (
        <div className="terac-prev-opps">
          <strong>Previous Studies</strong>
          {opportunities.map(opp => (
            <button
              key={opp.id}
              className="terac-prev-opp-btn"
              onClick={() => { setActiveOpp(opp); setStep('opportunity'); }}
            >
              {opp.name} — <span className={`terac-status--${opp.status}`}>{STATUS_LABELS[opp.status] || opp.status}</span>
            </button>
          ))}
        </div>
      )}

      <form className="terac-form" onSubmit={handleSubmit}>
        <div className="terac-field">
          <label>Study Name</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
        </div>

        <div className="terac-field">
          <label>Task Description</label>
          <textarea
            value={form.taskDescription}
            onChange={e => setForm(f => ({ ...f, taskDescription: e.target.value }))}
            rows={4}
            required
          />
        </div>

        <div className="terac-field">
          <label>Participant Profile</label>
          <textarea
            value={form.panelDescription}
            onChange={e => setForm(f => ({ ...f, panelDescription: e.target.value }))}
            rows={2}
            required
          />
        </div>

        <div className="terac-field-row">
          <div className="terac-field">
            <label><Clock size={12} /> Timeline (hours)</label>
            <input
              type="number"
              min={72}
              max={240}
              value={form.timelineHours}
              onChange={e => setForm(f => ({ ...f, timelineHours: e.target.value }))}
              required
            />
          </div>
          <div className="terac-field">
            <label>Expert Count</label>
            <input
              type="number"
              min={1}
              max={20}
              value={form.submissionCount}
              onChange={e => setForm(f => ({ ...f, submissionCount: e.target.value }))}
              required
            />
          </div>
        </div>

        <div className="terac-field">
          <label>UI Link (optional)</label>
          <input
            type="url"
            placeholder="https://your-interface.com/task"
            value={form.uiLink}
            onChange={e => setForm(f => ({ ...f, uiLink: e.target.value }))}
          />
        </div>

        {error && <div className="terac-error">{error}</div>}

        <button className="terac-connect-btn" type="submit" disabled={step === 'submitting'}>
          {step === 'submitting' ? <><Loader size={16} className="spinner" /> Launching...</> : 'Launch Expert Study'}
        </button>
      </form>
    </div>
  );
}
