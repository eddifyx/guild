import React from 'react';
export function AssetDumpUploadPanel({
  description,
  uploading,
  dragOver,
  uploadError,
  fileInputRef,
  styles,
  onDescriptionChange,
  onBrowse,
  onFileInput,
  onDrop,
  onSetDragOver,
  onClearUploadError,
}) {
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        onSetDragOver(true);
      }}
      onDragLeave={() => onSetDragOver(false)}
      onDrop={onDrop}
      style={{
        ...styles.uploadContainer,
        background: dragOver ? 'rgba(64, 255, 64, 0.05)' : 'transparent',
      }}
    >
      <div style={styles.uploadRow}>
        <div style={styles.descriptionWrap}>
          <input
            type="text"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Description (optional)"
            maxLength={200}
            style={styles.descriptionInput}
            onFocus={(event) => { event.target.style.borderColor = 'var(--accent)'; }}
            onBlur={(event) => { event.target.style.borderColor = 'var(--border)'; }}
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          style={styles.hiddenInput}
          onChange={onFileInput}
        />
        <button
          onClick={onBrowse}
          disabled={uploading}
          style={{
            ...styles.uploadButton,
            background: uploading ? 'var(--bg-tertiary)' : 'var(--accent)',
            color: uploading ? 'var(--text-muted)' : '#050705',
            cursor: uploading ? 'not-allowed' : 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {uploading ? 'Uploading...' : 'Upload Asset'}
        </button>
      </div>
      <div
        onClick={() => !uploading && onBrowse()}
        style={{
          ...styles.dropZone,
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
          color: dragOver ? 'var(--accent)' : 'var(--text-muted)',
          cursor: uploading ? 'not-allowed' : 'pointer',
          background: dragOver ? 'rgba(64, 255, 64, 0.06)' : 'transparent',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {dragOver ? 'Drop file here' : 'Drag & drop files here'}
      </div>
      {uploadError && (
        <div style={styles.uploadError}>
          <span>{uploadError}</span>
          <button onClick={onClearUploadError} style={styles.uploadErrorClose}>×</button>
        </div>
      )}
    </div>
  );
}
