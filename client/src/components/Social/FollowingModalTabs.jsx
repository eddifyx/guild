import React from 'react';
import { styles } from './FollowingModalStyles.mjs';

export function FollowingModalTabs({
  tabs,
  onChangeTab,
}) {
  return (
    <div style={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChangeTab(tab.key)}
          style={{
            ...styles.tabBtn,
            borderBottom: tab.active ? '2px solid var(--accent, #40FF40)' : '2px solid transparent',
            color: tab.active ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
        >
          {tab.label}
          {tab.count > 0 && (
            <span
              style={{
                ...styles.badge,
                background: tab.key === 'requests' && !tab.active ? 'var(--accent, #40FF40)' : 'var(--bg-tertiary, #333)',
                color: tab.key === 'requests' && !tab.active ? '#000' : 'var(--text-secondary)',
              }}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
