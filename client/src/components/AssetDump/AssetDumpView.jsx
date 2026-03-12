import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAssets } from '../../hooks/useAssets';
import { getFileUrl } from '../../api';

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getTimeRemaining(expiresAt) {
  const exp = expiresAt.includes('T') ? expiresAt : expiresAt.replace(' ', 'T') + 'Z';
  const diff = new Date(exp) - new Date();
  if (diff <= 0) return { text: 'Expired', urgent: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return { text: `${days}d ${hours}h left`, urgent: false };
  if (hours > 0) return { text: `${hours}h ${minutes}m left`, urgent: hours < 1 };
  return { text: `${minutes}m left`, urgent: true };
}

function getFileIcon(type) {
  if (type.startsWith('image/')) return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
  if (type.startsWith('video/')) return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
  if (type.startsWith('audio/')) return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    </svg>
  );
  // archive/zip
  if (type.includes('zip') || type.includes('rar') || type.includes('7z') || type.includes('tar') || type.includes('gz')) return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8v13H3V3h12l6 5z" />
      <path d="M14 3v6h6" />
      <path d="M10 12h4M10 15h4M10 18h4" />
    </svg>
  );
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
    </svg>
  );
}

export default function AssetDumpView() {
  const { user } = useAuth();
  const { assets, loading, uploadAsset, deleteAsset } = useAssets();
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [downloadNotice, setDownloadNotice] = useState(null);
  const [, setTick] = useState(0);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const downloadTimerRef = useRef(null);

  // Update countdown every 60s
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleUpload = useCallback(async (file) => {
    if (!file) return;
    setPendingFile({ name: file.name, size: file.size, type: file.type });
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    try {
      await uploadAsset(file, description.trim() || null, (pct) => setUploadProgress(pct));
      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    }
    setPendingFile(null);
    setUploading(false);
    setUploadProgress(0);
  }, [uploadAsset, description]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleDownload = useCallback((fileName, url) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();

    if (downloadTimerRef.current) clearTimeout(downloadTimerRef.current);
    setDownloadNotice(fileName);
    downloadTimerRef.current = setTimeout(() => setDownloadNotice(null), 3000);
  }, []);

  const handleDelete = async (assetId) => {
    try {
      await deleteAsset(assetId);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <>
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Upload area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          background: dragOver ? 'rgba(64, 255, 64, 0.05)' : 'transparent',
          transition: 'background 0.2s',
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              maxLength={200}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) handleUpload(file);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              padding: '8px 18px',
              background: uploading ? 'var(--bg-tertiary)' : 'var(--accent)',
              border: 'none',
              borderRadius: 6,
              color: uploading ? 'var(--text-muted)' : '#050705',
              fontSize: 12,
              fontWeight: 600,
              cursor: uploading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
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
          onClick={() => !uploading && fileInputRef.current?.click()}
          style={{
            marginTop: 10,
            padding: '18px 12px',
            border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 8,
            textAlign: 'center',
            color: dragOver ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 500,
            cursor: uploading ? 'not-allowed' : 'pointer',
            background: dragOver ? 'rgba(64, 255, 64, 0.06)' : 'transparent',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
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
          <div style={{
            marginTop: 8, padding: '7px 12px',
            background: 'rgba(220, 53, 69, 0.1)', border: '1px solid var(--danger)',
            borderRadius: 6, color: 'var(--danger)', fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          }}>
            <span>{uploadError}</span>
            <button onClick={() => setUploadError(null)}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
          </div>
        )}
      </div>

      {/* Asset grid */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20,
        }}
      >
        {loading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            padding: 40,
            color: 'var(--text-muted)',
            fontSize: 13,
          }}>
            Loading...
          </div>
        ) : assets.length === 0 && !pendingFile ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            gap: 12,
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
              <path d="M21 8v13H3V3h12l6 5z" />
              <path d="M14 3v6h6" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 500 }}>No assets yet</span>
            <span style={{ fontSize: 12 }}>Upload files to share with the group</span>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}>
            {pendingFile && (
              <div style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--accent)',
                borderRadius: 8,
                overflow: 'hidden',
                opacity: 0.85,
              }}>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ color: 'var(--accent)', flexShrink: 0 }}>
                      {getFileIcon(pendingFile.type || '')}
                    </span>
                    <span style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {pendingFile.name}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {formatSize(pendingFile.size)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                      {uploadProgress < 100 ? 'Uploading...' : 'Processing...'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {uploadProgress}%
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(64, 255, 64, 0.15)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2, background: 'var(--accent)',
                      width: `${uploadProgress}%`, transition: 'width 0.2s ease',
                    }} />
                  </div>
                </div>
              </div>
            )}
            {assets.map(asset => {
              const remaining = getTimeRemaining(asset.expires_at);
              const isOwner = asset.uploaded_by === user.userId;
              const url = getFileUrl(asset.file_url);
              const isImage = (asset.file_type || '').startsWith('image/');

              return (
                <div
                  key={asset.id}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  {/* Image preview */}
                  {isImage && (
                    <div style={{
                      height: 140,
                      background: 'var(--bg-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      cursor: 'pointer',
                    }}
                      onClick={() => window.open(url, '_blank')}
                    >
                      <img
                        src={url}
                        alt={asset.file_name}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'cover',
                          width: '100%',
                          height: '100%',
                        }}
                      />
                    </div>
                  )}

                  <div style={{ padding: '12px 14px' }}>
                    {/* File info row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                        {getFileIcon(asset.file_type || '')}
                      </span>
                      <span style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {asset.file_name}
                      </span>
                      <span style={{
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                      }}>
                        {formatSize(asset.file_size)}
                      </span>
                    </div>

                    {/* Description */}
                    {asset.description && (
                      <div style={{
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        marginBottom: 8,
                        lineHeight: 1.4,
                      }}>
                        {asset.description}
                      </div>
                    )}

                    {/* Meta row */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                    }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        by <span style={{ color: 'var(--accent)' }}>{asset.uploader_name}</span>
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: remaining.urgent ? 'var(--danger)' : 'var(--text-muted)',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {remaining.text}
                      </span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleDownload(asset.file_name, url)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '6px 0',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          color: 'var(--text-secondary)',
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--accent)';
                          e.currentTarget.style.color = 'var(--accent)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download
                      </button>
                      {isOwner && (
                        <button
                          onClick={() => handleDelete(asset.id)}
                          style={{
                            padding: '6px 12px',
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            color: 'var(--text-muted)',
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--danger)';
                            e.currentTarget.style.color = 'var(--danger)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.color = 'var(--text-muted)';
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {downloadNotice && (
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-tertiary)', border: '1px solid var(--accent)',
          borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center',
          gap: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', pointerEvents: 'none',
          whiteSpace: 'nowrap', maxWidth: '80%', overflow: 'hidden',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Downloading <strong>{downloadNotice}</strong> to your Downloads folder
          </span>
        </div>
      )}
    </div>
    </>
  );
}
