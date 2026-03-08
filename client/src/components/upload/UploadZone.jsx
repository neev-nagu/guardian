import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Image } from 'lucide-react';

export default function UploadZone({ onUpload, isUploading }) {
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      onUpload(acceptedFiles[0]);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    disabled: isUploading
  });

  return (
    <div
      {...getRootProps()}
      className={`upload-zone ${isDragActive ? 'upload-zone--active' : ''} ${isUploading ? 'upload-zone--disabled' : ''}`}
    >
      <input {...getInputProps()} />
      <div className="upload-zone-content">
        <div className="upload-zone-icon">
          {isDragActive ? <FileText size={48} /> : <Upload size={48} />}
        </div>
        <h3>{isDragActive ? 'Drop your document here' : 'Upload Financial Document'}</h3>
        <p>Drag & drop a receipt, invoice, or bank statement</p>
        <p className="upload-zone-formats">
          <Image size={14} /> JPG, PNG, PDF supported
        </p>
      </div>
    </div>
  );
}
