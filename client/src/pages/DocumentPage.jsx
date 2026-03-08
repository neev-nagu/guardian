import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Loader, Search } from 'lucide-react';
import { api } from '../api/client';
import FraudDashboard from '../components/analysis/FraudDashboard';
import MLPredictionPanel from '../components/analysis/MLPredictionPanel';
import RuleChecksPanel from '../components/analysis/RuleChecksPanel';
import ActionChoice from '../components/negotiation/ActionChoice';
import NegotiationMessage from '../components/negotiation/NegotiationMessage';
import TeracAdvisor from '../components/negotiation/TeracAdvisor';

export default function DocumentPage() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState(null);
  const [actionMode, setActionMode] = useState(null);
  const [mlPrediction, setMlPrediction] = useState(null);
  const [ruleChecks, setRuleChecks] = useState(null);

  useEffect(() => {
    api.getDocument(id)
      .then(setDoc)
      .catch(() => {})
      .finally(() => setLoading(false));

    api.getMLPrediction(id).then(setMlPrediction).catch(() => {});
    api.getRuleChecks(id).then(setRuleChecks).catch(() => {});
  }, [id]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const result = await api.triggerAnalysis(id);
      setDoc(prev => ({ ...prev, fraud_flags: result.flags }));
      if (result.ml_prediction) setMlPrediction(result.ml_prediction);
      if (result.rule_checks) setRuleChecks(result.rule_checks);
    } catch (err) {
      console.error('Analysis failed:', err);
    }
    setAnalyzing(false);
  };

  if (loading) {
    return <div className="page-loading"><Loader size={32} className="spinner" /> Loading document...</div>;
  }

  if (!doc) {
    return <div className="page-error">Document not found</div>;
  }

  const parsedData = doc.parsed_data ? JSON.parse(doc.parsed_data) : null;

  return (
    <div className="document-page">
      <Link to="/" className="back-link"><ArrowLeft size={16} /> Back</Link>

      <div className="document-header">
        <FileText size={28} />
        <div>
          <h1>{doc.original_name}</h1>
          <span className="document-meta">
            Uploaded {new Date(doc.upload_date).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Line Items Table */}
      {doc.line_items && doc.line_items.length > 0 && (
        <section className="section">
          <h2>Extracted Charges</h2>
          <div className="line-items-table-wrapper">
            <table className="line-items-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Vendor</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {doc.line_items.map(item => (
                  <tr key={item.id}>
                    <td>{item.description}</td>
                    <td>{item.vendor || '-'}</td>
                    <td><span className="category-pill">{item.category}</span></td>
                    <td>{item.date || '-'}</td>
                    <td className="amount">${item.amount?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              {parsedData?.total && (
                <tfoot>
                  <tr>
                    <td colSpan={4}><strong>Total</strong></td>
                    <td className="amount"><strong>${parsedData.total.toFixed(2)}</strong></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}

      {/* Fraud Analysis */}
      <section className="section">
        <div className="section-header">
          <h2>Fraud Analysis</h2>
          {(!doc.fraud_flags || doc.fraud_flags.length === 0) && !analyzing && (
            <button className="analyze-btn" onClick={runAnalysis}>
              <Search size={16} /> Analyze for Issues
            </button>
          )}
        </div>
        {analyzing ? (
          <div className="analyzing">
            <Loader size={24} className="spinner" /> Running full analysis pipeline...
          </div>
        ) : (
          <>
            <MLPredictionPanel mlPrediction={mlPrediction} />
            <RuleChecksPanel ruleChecks={ruleChecks} />
            <FraudDashboard
              documentId={id}
              flags={doc.fraud_flags}
              onSelectFlag={(flag) => {
                setSelectedFlag(flag);
                setActionMode(null);
              }}
            />
          </>
        )}
      </section>

      {/* Action Panel — always visible */}
      <section className="section action-section">
        <h2>{selectedFlag ? `Resolve: ${selectedFlag.description}` : 'Get Expert Help'}</h2>
        {!selectedFlag ? (
          <TeracAdvisor flag={null} documentId={id} />
        ) : !actionMode ? (
          <ActionChoice
            onChooseAI={() => setActionMode('ai')}
            onChooseTerac={() => setActionMode('terac')}
          />
        ) : actionMode === 'ai' ? (
          <NegotiationMessage flag={selectedFlag} />
        ) : (
          <TeracAdvisor flag={selectedFlag} documentId={id} />
        )}
        {selectedFlag && (
          <button className="back-to-choice" onClick={() => { setActionMode(null); setSelectedFlag(null); }}>
            Choose a different flag
          </button>
        )}
      </section>
    </div>
  );
}
