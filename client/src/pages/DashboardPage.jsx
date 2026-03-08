import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ChevronRight, AlertTriangle } from 'lucide-react';
import SummaryPanel from '../components/dashboard/SummaryPanel';
import RiskHeatmap from '../components/dashboard/RiskHeatmap';
import { api } from '../api/client';

export default function DashboardPage() {
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    api.getDocuments().then(setDocuments).catch(() => {});
  }, []);

  const analyzedDocs = documents.filter(d => d.status === 'analyzed');

  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>
      <SummaryPanel />
      <RiskHeatmap />

      <section className="section">
        <h2>All Documents</h2>
        {documents.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} />
            <p>No documents uploaded yet. <Link to="/">Upload one now</Link></p>
          </div>
        ) : (
          <div className="document-list">
            {documents.map(doc => (
              <Link to={`/document/${doc.id}`} key={doc.id} className="document-card">
                <FileText size={20} />
                <div className="document-card-info">
                  <span className="document-card-name">{doc.original_name}</span>
                  <span className="document-card-date">
                    {new Date(doc.upload_date).toLocaleDateString()}
                  </span>
                </div>
                <span className={`document-card-status document-card-status--${doc.status}`}>
                  {doc.status}
                </span>
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
