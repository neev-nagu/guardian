import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';

export default function ExpertRespondPage() {
  const { opportunityId } = useParams();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ expertName: '', response: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getTeracRespondTask(opportunityId)
      .then(data => {
        if (data.error) setError(data.error);
        else setTask(data);
      })
      .catch(() => setError('Could not load this task.'))
      .finally(() => setLoading(false));
  }, [opportunityId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.response.trim()) { setError('Please write a response.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.submitTeracResponse(opportunityId, form);
      if (res.error) throw new Error(res.error);
      setDone(true);
    } catch (err) {
      setError(err.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="respond-page">
        <div className="respond-card">
          <p className="respond-loading">Loading task...</p>
        </div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="respond-page">
        <div className="respond-card">
          <h2>Task not found</h2>
          <p className="respond-error">{error}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="respond-page">
        <div className="respond-card respond-card--done">
          <h2>Response submitted</h2>
          <p>Thank you. Your response has been recorded and sent to the requester.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="respond-page">
      <div className="respond-card">
        <div className="respond-header">
          <span className="respond-tag">Expert Review Request</span>
          <h1 className="respond-title">{task.name}</h1>
        </div>

        <div className="respond-task">
          <h3>What we need from you</h3>
          <p>{task.taskDescription}</p>
        </div>

        {task.panelDescription && (
          <div className="respond-profile">
            <h3>Looking for</h3>
            <p>{task.panelDescription}</p>
          </div>
        )}

        <form className="respond-form" onSubmit={handleSubmit}>
          <div className="respond-field">
            <label>Your name or organization <span className="respond-optional">(optional)</span></label>
            <input
              type="text"
              placeholder="e.g. Jane Smith, CPA"
              value={form.expertName}
              onChange={e => setForm(f => ({ ...f, expertName: e.target.value }))}
            />
          </div>

          <div className="respond-field">
            <label>Your response <span className="respond-required">*</span></label>
            <textarea
              placeholder="Write your analysis, findings, recommendations, or any relevant information..."
              rows={10}
              value={form.response}
              onChange={e => setForm(f => ({ ...f, response: e.target.value }))}
              required
            />
          </div>

          {error && <p className="respond-error">{error}</p>}

          <button className="respond-submit" type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Response'}
          </button>
        </form>
      </div>
    </div>
  );
}
