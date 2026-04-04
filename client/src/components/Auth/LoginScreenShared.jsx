import React from 'react';
export function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        background: 'none',
        border: 'none',
        color: 'rgba(64, 255, 64, 0.4)',
        cursor: 'pointer',
        padding: 8,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'color 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'rgba(64, 255, 64, 0.8)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'rgba(64, 255, 64, 0.4)';
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}

export const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 8,
  border: '1px solid rgba(64, 255, 64, 0.07)',
  background: '#0b0d0b',
  color: '#e0e8e0',
  fontSize: 14,
  outline: 'none',
  marginBottom: 12,
  transition: 'border-color 0.2s',
};
