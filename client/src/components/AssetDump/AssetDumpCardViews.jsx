import React from 'react';
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
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
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

export function PendingAssetCard({ pendingAssetView, styles }) {
  if (!pendingAssetView) return null;

  return (
    <div style={styles.pendingCard}>
      <div style={styles.cardBody}>
        <div style={styles.fileRow}>
          <span style={{ color: 'var(--accent)', flexShrink: 0 }}>
            {getFileIcon(pendingAssetView.type || '')}
          </span>
          <span style={styles.fileName}>{pendingAssetView.name}</span>
          <span style={styles.fileMeta}>{pendingAssetView.sizeLabel}</span>
        </div>
        <div style={styles.uploadMetaRow}>
          <span style={styles.uploadLabel}>{pendingAssetView.uploadLabel}</span>
          <span style={styles.uploadPercent}>{pendingAssetView.uploadProgress}%</span>
        </div>
        <div style={styles.progressTrack}>
          <div
            style={{
              height: '100%',
              borderRadius: 2,
              background: 'var(--accent)',
              width: `${pendingAssetView.uploadProgress}%`,
              transition: 'width 0.2s ease',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function AssetCard({
  asset,
  styles,
  onDownload,
  onDelete,
  onOpenImagePreview,
}) {
  return (
    <div
      style={styles.assetCard}
      onMouseEnter={(event) => { event.currentTarget.style.borderColor = 'var(--border-strong)'; }}
      onMouseLeave={(event) => { event.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      {asset.isImage && (
        <div
          style={styles.imagePreview}
          onClick={() => onOpenImagePreview({ url: asset.url, name: asset.file_name })}
        >
          <img src={asset.url} alt={asset.file_name} style={styles.image} />
        </div>
      )}

      <div style={styles.cardBody}>
        <div style={styles.fileRow}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            {getFileIcon(asset.file_type || '')}
          </span>
          <span style={styles.fileName}>{asset.file_name}</span>
          <span style={styles.fileMeta}>{asset.sizeLabel}</span>
        </div>

        {asset.description && (
          <div style={styles.description}>{asset.description}</div>
        )}

        <div style={styles.metaRow}>
          <span style={styles.uploaderMeta}>
            by <span style={styles.uploaderName}>{asset.uploader_name}</span>
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: asset.remaining.urgent ? 'var(--danger)' : 'var(--text-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {asset.remaining.text}
          </span>
        </div>

        <div style={styles.actionRow}>
          <button
            onClick={() => onDownload(asset.file_name, asset.url)}
            style={{ ...styles.actionButton, flex: 1 }}
            onMouseEnter={(event) => {
              event.currentTarget.style.borderColor = 'var(--accent)';
              event.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.borderColor = 'var(--border)';
              event.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
          {asset.isOwner && (
            <button
              onClick={() => onDelete(asset.id)}
              style={styles.deleteButton}
              onMouseEnter={(event) => {
                event.currentTarget.style.borderColor = 'var(--danger)';
                event.currentTarget.style.color = 'var(--danger)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.borderColor = 'var(--border)';
                event.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
