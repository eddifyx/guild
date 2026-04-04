import React, { memo } from 'react';

import {
  AddonDeleteIcon,
  AddonDownloadIcon,
  AddonFileIcon,
  AddonUploadedIcon,
} from './AddonViewIconViews.jsx';
import { AddonPendingAddonCardView } from './AddonUploadSectionViews.jsx';

export const AddonCardView = memo(function AddonCardView({
  addon,
  addonState = {},
  onOpenImagePreview = () => {},
  onDownload = () => {},
  onDelete = () => {},
}) {
  return (
    <div
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={(event) => { event.currentTarget.style.borderColor = 'var(--border-strong)'; }}
      onMouseLeave={(event) => { event.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      {addonState.isImage && (
        <div
          style={{
            height: 140, background: 'var(--bg-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', cursor: 'pointer',
          }}
          onClick={() => onOpenImagePreview(addonState.url, addon.file_name)}
        >
          <img
            src={addonState.url}
            alt={addon.file_name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover', width: '100%', height: '100%' }}
          />
        </div>
      )}

      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            <AddonFileIcon variant={addonState.iconVariant} />
          </span>
          <span style={{
            flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {addon.file_name}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
            {addonState.formattedSize}
          </span>
        </div>

        {addon.description && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.4 }}>
            {addon.description}
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            by <span style={{ color: 'var(--accent)' }}>{addon.uploader_name}</span>
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => onDownload(addon.file_name, addonState.url)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, padding: '6px 0', background: 'var(--bg-primary)',
              border: '1px solid var(--border)', borderRadius: 4,
              color: 'var(--text-secondary)', fontSize: 11, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={(event) => { event.currentTarget.style.borderColor = 'var(--accent)'; event.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={(event) => { event.currentTarget.style.borderColor = 'var(--border)'; event.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <AddonDownloadIcon />
            Download
          </button>
          {addonState.canDelete && (
            <button
              onClick={() => onDelete(addon.id)}
              style={{
                padding: '6px 12px', background: 'transparent',
                border: '1px solid var(--border)', borderRadius: 4,
                color: 'var(--text-muted)', fontSize: 11, fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={(event) => { event.currentTarget.style.borderColor = 'var(--danger)'; event.currentTarget.style.color = 'var(--danger)'; }}
              onMouseLeave={(event) => { event.currentTarget.style.borderColor = 'var(--border)'; event.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <AddonDeleteIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export const AddonEmptyStateView = memo(function AddonEmptyStateView() {
  return (
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
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
      <span style={{ fontSize: 14, fontWeight: 500 }}>No addons yet</span>
      <span style={{ fontSize: 12 }}>Upload files here — they are stored permanently</span>
    </div>
  );
});

export const AddonDownloadNoticeView = memo(function AddonDownloadNoticeView({
  noticeLabel = '',
}) {
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--bg-tertiary)', border: '1px solid var(--accent)',
      borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center',
      gap: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', pointerEvents: 'none',
      whiteSpace: 'nowrap', maxWidth: '80%', overflow: 'hidden',
    }}>
      <AddonUploadedIcon />
      <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <strong>{noticeLabel}</strong>
      </span>
    </div>
  );
});

export function AddonGridView({
  emptyState = { showLoading: false, showEmpty: false },
  pendingAddon = null,
  addonItems = [],
  onOpenImagePreview = () => {},
  onDownload = () => {},
  onDelete = () => {},
}) {
  if (emptyState.showLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: 40,
        color: 'var(--text-muted)',
        fontSize: 13,
      }}>
        Loading...
      </div>
    );
  }

  if (emptyState.showEmpty) {
    return <AddonEmptyStateView />;
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 12,
    }}>
      {pendingAddon && (
        <AddonPendingAddonCardView pendingAddon={pendingAddon} />
      )}
      {addonItems.map(({ addon, addonState }) => (
        <AddonCardView
          key={addon.id}
          addon={addon}
          addonState={addonState}
          onOpenImagePreview={onOpenImagePreview}
          onDownload={onDownload}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
