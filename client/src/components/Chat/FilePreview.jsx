import React from 'react';
import FilePreviewContextMenu from './FilePreviewContextMenu.jsx';
import { formatFilePreviewSize } from '../../features/messaging/filePreviewModel.mjs';
import { useFilePreviewController } from '../../features/messaging/filePreviewRuntime.mjs';

export default function FilePreview({ attachment, compact = false }) {
  const {
    name,
    size,
    type,
    isEncrypted,
    isInlineMedia,
    url,
    displayUrl,
    previewBoxStyle,
    mediaStyle,
    ctxMenu,
    decryptError,
    decrypting,
    handleDecrypt,
    handleContextMenu,
    closeContextMenu,
    copyImage,
    openInBrowser,
  } = useFilePreviewController({ attachment, compact });

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
      <div style={previewBoxStyle}>
        <img
          src={displayUrl}
          alt={name}
          style={mediaStyle}
          onClick={() => openInBrowser()}
          onContextMenu={handleContextMenu}
        />
        {ctxMenu && (
          <FilePreviewContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            onCopyImage={copyImage}
            onOpenInBrowser={openInBrowser}
            onClose={closeContextMenu}
          />
        )}
      </div>
    );
  }

  if (type.startsWith('video/') && displayUrl) {
    return (
      <div style={previewBoxStyle}>
        <video
          src={displayUrl}
          controls
          style={{
            ...mediaStyle,
            cursor: 'default',
          }}
        />
      </div>
    );
  }

  if (type.startsWith('audio/') && displayUrl) {
    return (
      <div style={{ marginTop: compact ? 4 : 8 }}>
        <audio src={displayUrl} controls style={{ width: '100%', maxWidth: compact ? 220 : 350 }} />
      </div>
    );
  }

  if (isEncrypted && !displayUrl) {
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
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatFilePreviewSize(size)}</span>
      </button>
    );
  }

  return (
    <a
      href={displayUrl || url}
      download={name}
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
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatFilePreviewSize(size)}</span>
    </a>
  );
}
