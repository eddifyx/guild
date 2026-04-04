import React from 'react';
import { buildSidebarAssetButtonState } from '../../features/layout/sidebarPanelsModel.mjs';
import { SidebarSectionHeader } from './SidebarShared.jsx';

function SidebarAssetButton({ buttonState, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '7px 12px',
        border: 'none',
        borderRadius: 6,
        background: buttonState.background,
        color: buttonState.color,
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: 13,
        transition: 'all 0.15s',
        fontWeight: buttonState.fontWeight,
      }}
      onMouseEnter={(event) => {
        if (!buttonState.isActive) {
          event.currentTarget.style.background = 'var(--bg-hover)';
          event.currentTarget.style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={(event) => {
        if (!buttonState.isActive) {
          event.currentTarget.style.background = 'transparent';
          event.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
    >
      {children}
    </button>
  );
}

export default function SidebarAssetSection({
  conversation,
  onSelectAssetDump = () => {},
  onSelectAddons = () => {},
}) {
  const assetButtonState = buildSidebarAssetButtonState({
    conversationType: conversation?.type,
    targetType: 'assets',
  });
  const addonsButtonState = buildSidebarAssetButtonState({
    conversationType: conversation?.type,
    targetType: 'addons',
  });

  return (
    <div style={{ marginBottom: 16 }}>
      <SidebarSectionHeader label="Asset Dump" />
      <SidebarAssetButton buttonState={assetButtonState} onClick={onSelectAssetDump}>
        <span style={{
          color: assetButtonState.iconColor,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 8v13H3V3h12l6 5z" />
            <path d="M14 3v6h6" />
          </svg>
        </span>
        <span className="truncate">Dumping Grounds</span>
      </SidebarAssetButton>
      <SidebarAssetButton buttonState={addonsButtonState} onClick={onSelectAddons}>
        <span style={{
          color: addonsButtonState.iconColor,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </span>
        <span className="truncate">Addons</span>
      </SidebarAssetButton>
    </div>
  );
}
