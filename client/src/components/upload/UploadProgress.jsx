import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, CheckCircle, AlertCircle, FileSearch, Brain, ScanLine } from 'lucide-react';
import { api } from '../../api/client';

const stages = {
  processing: { label: 'Reading document...', icon: ScanLine, progress: 20 },
  ocr_done: { label: 'Extracting data...', icon: FileSearch, progress: 40 },
  parsed: { label: 'Analyzing for fraud...', icon: Brain, progress: 70 },
  analyzed: { label: 'Complete!', icon: CheckCircle, progress: 100 },
  failed: { label: 'Processing failed', icon: AlertCircle, progress: 0 },
};

export default function UploadProgress({ documentId, onComplete }) {
  const [status, setStatus] = useState('processing');
  const navigate = useNavigate();

  useEffect(() => {
    if (!documentId) return;

    const poll = setInterval(async () => {
      try {
        const { ocr_status, status: docStatus } = await api.getDocumentStatus(documentId);

        let currentStatus = 'processing';
        if (docStatus === 'failed' || ocr_status === 'failed') {
          currentStatus = 'failed';
        } else if (docStatus === 'analyzed') {
          currentStatus = 'analyzed';
        } else if (docStatus === 'parsed') {
          currentStatus = 'parsed';
        } else if (ocr_status === 'completed') {
          currentStatus = 'ocr_done';
        }

        setStatus(currentStatus);

        // Terminal states: navigate to document
        const done = currentStatus === 'analyzed' || currentStatus === 'failed';
        // Also treat ocr_complete as terminal (Gemini failed but OCR worked)
        const partial = docStatus === 'ocr_complete';
        if (done || partial) {
          clearInterval(poll);
          if (currentStatus !== 'failed') {
            setTimeout(() => {
              onComplete?.();
              navigate(`/document/${documentId}`);
            }, 600);
          }
        }
      } catch {
        // keep polling
      }
    }, 1500);

    return () => clearInterval(poll);
  }, [documentId, navigate, onComplete]);

  const stage = stages[status] || stages.processing;
  const Icon = stage.icon;

  return (
    <div className="upload-progress">
      <div className="upload-progress-bar-bg">
        <div className="upload-progress-bar" style={{ width: `${stage.progress}%` }} />
      </div>
      <div className="upload-progress-status">
        {status === 'failed' ? (
          <AlertCircle size={20} className="text-red" />
        ) : status === 'analyzed' ? (
          <CheckCircle size={20} className="text-green" />
        ) : (
          <Loader size={20} className="spinner" />
        )}
        <Icon size={18} />
        <span>{stage.label}</span>
      </div>
    </div>
  );
}
