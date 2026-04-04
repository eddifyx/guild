import React from 'react';
import {
  VOICE_PROCESSING_MODES,
} from '../../utils/voiceProcessing';

export { VOICE_PROCESSING_MODES };

export function PanelShell({ labelStyle, title, children, style = {} }) {
  return (
    <div style={{ marginBottom: 16, ...style }}>
      <label style={labelStyle}>{title}</label>
      {children}
    </div>
  );
}

export function SmallHint({ children, style = {} }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4, ...style }}>
      {children}
    </div>
  );
}

export function ToggleOption({
  active,
  inactiveBackground,
  inactiveBorder,
  activeBackground,
  activeBorder,
  indicatorBackground,
  indicatorBorder,
  indicatorLeftActive = 16,
  indicatorLeftInactive = 1,
  title,
  description,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 10px',
        background: active ? activeBackground : inactiveBackground,
        border: `1px solid ${active ? activeBorder : inactiveBorder}`,
        borderRadius: 6,
        color: 'var(--text-primary)',
        fontSize: 13,
        cursor: 'pointer',
        transition: 'border-color 0.2s',
        textAlign: 'left',
      }}
    >
      <div style={{
        width: 32,
        height: 18,
        borderRadius: 9,
        background: active ? indicatorBackground : 'var(--bg-tertiary)',
        border: `1px solid ${active ? indicatorBorder : inactiveBorder}`,
        position: 'relative',
        transition: 'all 0.2s',
        flexShrink: 0,
      }}>
        <div style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 1,
          left: active ? indicatorLeftActive : indicatorLeftInactive,
          transition: 'left 0.2s',
        }} />
      </div>
      <div>
        <div style={{ fontWeight: 500, fontSize: 12 }}>{title}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
    </button>
  );
}
