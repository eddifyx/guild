import React, { memo } from 'react';

import {
  AddonDropZoneIcon,
  AddonFileIcon,
  AddonUploadIcon,
} from './AddonViewIconViews.jsx';

export const AddonUploadSectionView = memo(function AddonUploadSectionView({
  description,
  setDescription,
  uploadSectionState,
  dragOver = false,
  uploadError,
  onClearUploadError = () => {},
  onOpenFilePicker = () => {},
  onDragOver = () => {},
  onDragLeave = () => {},
  onDrop = () => {},
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
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
            onChange={(event) => setDescription(event.target.value)}
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
            onFocus={(event) => { event.target.style.borderColor = 'var(--accent)'; }}
            onBlur={(event) => { event.target.style.borderColor = 'var(--border)'; }}
          />
        </div>
        <button
          onClick={onOpenFilePicker}
          disabled={uploadSectionState.uploadButtonDisabled}
          style={{
            padding: '8px 18px',
            background: uploadSectionState.uploadButtonBackground,
            border: 'none',
            borderRadius: 6,
            color: uploadSectionState.uploadButtonColor,
            fontSize: 12,
            fontWeight: 600,
            cursor: uploadSectionState.uploadButtonCursor,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
          }}
        >
          <AddonUploadIcon />
          {uploadSectionState.uploadButtonLabel}
        </button>
      </div>
      <div
        onClick={onOpenFilePicker}
        style={{
          marginTop: 10,
          padding: '18px 12px',
          border: `2px dashed ${uploadSectionState.dropZoneBorderColor}`,
          borderRadius: 8,
          textAlign: 'center',
          color: uploadSectionState.dropZoneColor,
          fontSize: 12,
          fontWeight: 500,
          cursor: uploadSectionState.dropZoneCursor,
          background: uploadSectionState.dropZoneBackground,
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <AddonDropZoneIcon />
        {uploadSectionState.dropZoneLabel}
      </div>
      {uploadSectionState.showUploadError && (
        <div style={{
          marginTop: 8, padding: '7px 12px',
          background: 'rgba(220, 53, 69, 0.1)', border: '1px solid var(--danger)',
          borderRadius: 6, color: 'var(--danger)', fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span>{uploadError}</span>
          <button
            onClick={onClearUploadError}
            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}
          >
            x
          </button>
        </div>
      )}
    </div>
  );
});

export const AddonPendingAddonCardView = memo(function AddonPendingAddonCardView({
  pendingAddon = null,
}) {
  if (!pendingAddon) return null;

  return (
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
            <AddonFileIcon variant={pendingAddon.iconVariant} />
          </span>
          <span style={{
            flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {pendingAddon.name}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
            {pendingAddon.formattedSize}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
            {pendingAddon.statusLabel}
          </span>
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {pendingAddon.uploadProgress}%
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(64, 255, 64, 0.15)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2, background: 'var(--accent)',
            width: `${pendingAddon.uploadProgress}%`, transition: 'width 0.2s ease',
          }} />
        </div>
      </div>
    </div>
  );
});
