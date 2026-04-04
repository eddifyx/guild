import React, { useEffect, useState } from 'react';

export function SourceCard({ source, isSelected, onClick }) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const hasThumbnail = !thumbnailFailed && typeof source.thumbnail === 'string' && source.thumbnail.startsWith('data:image/');
  const hasIcon = typeof source.icon === 'string' && source.icon.startsWith('data:image/');

  useEffect(() => {
    setThumbnailFailed(false);
  }, [source.id, source.thumbnail]);

  return (
    <button
      onClick={onClick}
      style={{
        background: isSelected ? 'rgba(64, 255, 64, 0.1)' : 'var(--bg-primary)',
        border: isSelected ? '2px solid var(--accent)' : '2px solid var(--border)',
        borderRadius: 8,
        padding: 6,
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'border-color 0.15s, background 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        willChange: 'border-color',
        contain: 'layout style',
      }}
      onMouseEnter={(event) => {
        if (!isSelected) {
          event.currentTarget.style.borderColor = 'var(--text-muted)';
        }
      }}
      onMouseLeave={(event) => {
        if (!isSelected) {
          event.currentTarget.style.borderColor = 'var(--border)';
        }
      }}
    >
      {hasThumbnail ? (
        <img
          src={source.thumbnail}
          alt={source.name}
          draggable={false}
          onError={() => setThumbnailFailed(true)}
          style={{ width: '100%', aspectRatio: '16/9', borderRadius: 4, objectFit: 'contain', background: '#000' }}
        />
      ) : (
        <div style={{
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: 4,
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {hasIcon ? (
            <img
              src={source.icon}
              alt=""
              draggable={false}
              style={{ width: 28, height: 28, objectFit: 'contain' }}
            />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {source.id.startsWith('screen:') ? (
                <>
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </>
              ) : (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                </>
              )}
            </svg>
          )}
        </div>
      )}
      <span style={{
        fontSize: 11,
        color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
        fontWeight: isSelected ? 600 : 400,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '100%',
      }}>
        {source.name}
      </span>
    </button>
  );
}
