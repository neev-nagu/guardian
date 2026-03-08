import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FileText, ChevronRight, Shield } from 'lucide-react'
import UploadZone from '../components/upload/UploadZone'
import UploadProgress from '../components/upload/UploadProgress'
import { api } from '../api/client'

export default function HomePage() {
  // track upload state and which doc is currently processing
  const [uploading, setUploading] = useState(false)
  const [currentDocId, setCurrentDocId] = useState(null)
  const [documents, setDocuments] = useState([])

  // pull latest doc list from server
  const refreshDocs = () => api.getDocuments().then(setDocuments).catch(() => {})

  // load docs on mount
  useEffect(() => { refreshDocs() }, [])

  // kick off upload then start tracking progress
  const handleUpload = async (file) => {
    setUploading(true)
    try {
      const result = await api.uploadDocument(file)
      setCurrentDocId(result.documentId)
      refreshDocs()
    } catch (err) {
      console.error('Upload failed:', err)
      setUploading(false)
    }
  }

  return (
    <div className="home-page">
      <div className="hero">
        <Shield size={48} className="hero-icon" />
        <h1>Papaya</h1>
        <p>Upload a receipt, invoice, or bank statement. Our AI detects fraud and generates dispute messages to recover your money.</p>
      </div>

      {/* file drop zone */}
      <UploadZone onUpload={handleUpload} isUploading={uploading} />

      {/* live progress bar while doc is being analyzed */}
      {currentDocId && <UploadProgress documentId={currentDocId} onComplete={refreshDocs} />}

      {/* list of previously uploaded docs */}
      {documents.length > 0 && (
        <div className="recent-documents">
          <h2>Recent Documents</h2>
          <div className="document-list">
            {documents.map(doc => (
              <Link to={`/document/${doc.id}`} key={doc.id} className="document-card">
                <FileText size={20} />
                <div className="document-card-info">
                  <span className="document-card-name">{doc.original_name}</span>
                  <span className="document-card-date">{new Date(doc.upload_date).toLocaleDateString()}</span>
                </div>
                <span className={`document-card-status document-card-status--${doc.status}`}>
                  {doc.status}
                </span>
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
