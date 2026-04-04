import React, { useRef, useState } from 'react';
import { uploadChatAttachment } from '../../utils/chatUploads';

export default function FileUploadButton({ onUploaded, onError, beforeUpload = null, multiple = false }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleChange = async (e) => {
    const selectedFiles = Array.from(e.target.files || []).filter(Boolean);
    if (selectedFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of selectedFiles) {
        const validationError = typeof beforeUpload === 'function' ? beforeUpload(file) : null;
        if (validationError) {
          throw new Error(validationError);
        }
        const result = await uploadChatAttachment(file);
        onUploaded(result);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      const message = err?.message || 'Upload failed';
      if (onError) onError(message);
      else alert('Upload failed: ' + message);
    }
    setUploading(false);
    inputRef.current.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Attach file"
        style={{
          background: 'none',
          border: 'none',
          color: uploading ? 'var(--text-muted)' : 'var(--text-secondary)',
          cursor: uploading ? 'wait' : 'pointer',
          fontSize: 20,
          padding: 0,
          width: 38,
          height: 38,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {uploading ? (
          <svg width="20" height="20" viewBox="0 0 20 20" style={{ animation: 'spin 1s linear infinite' }}>
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="40" strokeDashoffset="10" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        )}
      </button>
    </>
  );
}
