import { useState, useEffect, useCallback, useRef } from 'react';
import { getFileUrl } from '../../api';
import { decryptAttachment } from '../../crypto/attachmentEncryption';

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function ImageContextMenu({ x, y, url, name, onClose }) {
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('click', handler);
    window.addEventListener('contextmenu', handler);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('contextmenu', handler);
    };
  }, [onClose]);

  const copyImage = async () => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const pngBlob = blob.type === 'image/png' ? blob : await new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);
          canvas.toBlob(resolve, 'image/png');
        };
        img.src = URL.createObjectURL(blob);
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
    } catch (err) {
      console.error('Failed to copy image:', err);
    }
    onClose();
  };

  const menuItem = {
    padding: '6px 24px 6px 12px',
    fontSize: 12,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'none',
    border: 'none',
    width: '100%',
    textAlign: 'left',
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 9999,
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-strong)',
        borderRadius: 6,
        padding: '4px 0',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        minWidth: 160,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        style={menuItem}
        onClick={copyImage}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
        Copy Image
      </button>
      <button
        style={menuItem}
        onClick={() => { window.open(url, '_blank'); onClose(); }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        Open in Browser
      </button>
    </div>
  );
}

export default function FilePreview({ attachment }) {
  const isEncrypted = !!(attachment.encryptionKey || attachment._encryptionKey);
  const encKey = attachment.encryptionKey || attachment._encryptionKey;
  const encDigest = attachment.encryptionDigest || attachment._encryptionDigest;

  const serverUrl = attachment.serverFileUrl || attachment.fileUrl || attachment.file_url;
  const url = getFileUrl(serverUrl);
  const localPreviewUrl = attachment._previewUrl || null;
  const name = attachment.originalFileName || attachment._originalName || attachment.fileName || attachment.file_name;
  const type = attachment.originalFileType || attachment._originalType || attachment.fileType || attachment.file_type || '';
  const size = attachment.originalFileSize || attachment._originalSize || attachment.fileSize || attachment.file_size || 0;
  const isInlineMedia = type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/');

  const [ctxMenu, setCtxMenu] = useState(null);
  const [decryptedUrl, setDecryptedUrl] = useState(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState(null);
  const [stickyLocalPreviewUrl, setStickyLocalPreviewUrl] = useState(localPreviewUrl);
  const decryptedUrlRef = useRef(null);
  const lastAttachmentKeyRef = useRef(null);

  useEffect(() => {
    return () => {
      if (decryptedUrlRef.current) {
        URL.revokeObjectURL(decryptedUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (localPreviewUrl) {
      setStickyLocalPreviewUrl(localPreviewUrl);
    }
  }, [localPreviewUrl]);

  useEffect(() => {
    const attachmentKey = [serverUrl || '', encKey || '', encDigest || '', name || ''].join('|');
    if (lastAttachmentKeyRef.current === attachmentKey) return;
    lastAttachmentKeyRef.current = attachmentKey;

    if (decryptedUrlRef.current) {
      URL.revokeObjectURL(decryptedUrlRef.current);
      decryptedUrlRef.current = null;
    }

    setDecryptedUrl(null);
    setDecrypting(false);
    setDecryptError(null);
    setStickyLocalPreviewUrl(localPreviewUrl || null);
  }, [serverUrl, encKey, encDigest, name, localPreviewUrl]);

  const handleDecrypt = useCallback(async () => {
    if (decryptedUrl || decrypting || !isEncrypted) return;
    setDecrypting(true);
    setDecryptError(null);
    try {
      const blob = await decryptAttachment(url, encKey, encDigest, type);
      const objUrl = URL.createObjectURL(blob);
      if (decryptedUrlRef.current) {
        URL.revokeObjectURL(decryptedUrlRef.current);
      }
      decryptedUrlRef.current = objUrl;
      setDecryptedUrl(objUrl);
    } catch (err) {
      console.error('Attachment decryption failed:', err);
      setDecryptError(err.message);
    }
    setDecrypting(false);
  }, [decryptedUrl, decrypting, isEncrypted, url, encKey, encDigest, type]);

  useEffect(() => {
    if (isEncrypted && isInlineMedia && !stickyLocalPreviewUrl && !decryptedUrl && !decrypting && !decryptError) {
      handleDecrypt();
    }
  }, [isEncrypted, isInlineMedia, stickyLocalPreviewUrl, decryptedUrl, decrypting, decryptError, handleDecrypt]);

  const displayUrl = isEncrypted ? (stickyLocalPreviewUrl || decryptedUrl) : url;

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  if (isEncrypted && isInlineMedia && !displayUrl) {
    return (
      <div style={{ marginTop: 8, padding: '12px 16px', background: 'rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)' }}>
        {decryptError ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span>{`Decryption failed: ${decryptError}`}</span>
            <button
              onClick={handleDecrypt}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: 11,
                padding: '4px 8px',
              }}
            >
              Retry
            </button>
          </div>
        ) : 'Decrypting attachment...'}
      </div>
    );
  }

  if (type.startsWith('image/') && displayUrl) {
    return (
      <div style={{ marginTop: 8, maxWidth: 400 }}>
        <img
          src={displayUrl}
          alt={name}
          style={{
            maxWidth: '100%',
            maxHeight: 300,
            borderRadius: 8,
            cursor: 'pointer',
          }}
          onClick={() => window.open(displayUrl, '_blank')}
          onContextMenu={handleContextMenu}
        />
        {ctxMenu && (
          <ImageContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            url={displayUrl}
            name={name}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </div>
    );
  }

  if (type.startsWith('video/') && displayUrl) {
    return (
      <div style={{ marginTop: 8, maxWidth: 400 }}>
        <video
          src={displayUrl}
          controls
          style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8 }}
        />
      </div>
    );
  }

  if (type.startsWith('audio/') && displayUrl) {
    return (
      <div style={{ marginTop: 8 }}>
        <audio src={displayUrl} controls style={{ width: '100%', maxWidth: 350 }} />
      </div>
    );
  }

  if (isEncrypted && !decryptedUrl) {
    return (
      <button
        onClick={handleDecrypt}
        disabled={decrypting}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 8,
          padding: '8px 14px',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 8,
          color: 'var(--text-primary)',
          fontSize: 13,
          border: '1px solid var(--border)',
          cursor: decrypting ? 'wait' : 'pointer',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        <span>{decrypting ? 'Decrypting...' : (decryptError ? 'Retry decryption' : name)}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatSize(size)}</span>
      </button>
    );
  }

  return (
    <a
      href={displayUrl || url}
      download={name}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        padding: '8px 14px',
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 8,
        color: 'var(--text-primary)',
        textDecoration: 'none',
        fontSize: 13,
        border: '1px solid var(--border)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
      <span>{name}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatSize(size)}</span>
    </a>
  );
}