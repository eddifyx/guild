import React, { memo } from 'react';

import { useGuildSettingsController } from '../../features/guild/useGuildSettingsController.mjs';
import {
  AdminTab,
  InviteTab,
  MembersTab,
  OverviewTab,
  RanksTab,
} from './GuildSettingsModalPanels.jsx';
import { styles } from './GuildSettingsModalStyles.mjs';

function GuildSettingsModal({ onClose, openTraceId = null }) {
  const controller = useGuildSettingsController({
    onClose,
    openTraceId,
  });

  return (
    <div onClick={controller.onClose} style={styles.overlay}>
      <div onClick={(event) => event.stopPropagation()} style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>{controller.title}</h2>
          <button onClick={controller.onClose} style={styles.closeBtn}>&times;</button>
        </div>

        {controller.error && <div style={styles.error}>{controller.error}</div>}
        {controller.success && <div style={styles.success}>{controller.success}</div>}

        {!controller.permissionsReady ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading...
          </div>
        ) : (
          <>
            <div style={styles.tabs}>
              {controller.visibleTabs.map((visibleTab) => (
                <button
                  key={visibleTab}
                  onClick={() => controller.onSelectTab(visibleTab)}
                  style={{ ...styles.tab, ...(controller.tab === visibleTab ? styles.tabActive : {}) }}
                >
                  {visibleTab}
                </button>
              ))}
            </div>

            <div style={{ ...styles.content, opacity: controller.isTabPending ? 0.8 : 1 }}>
              {controller.tab === 'Overview' && <OverviewTab {...controller.overviewProps} />}
              {controller.tab === 'Members' && <MembersTab {...controller.membersProps} />}
              {controller.tab === 'Ranks' && <RanksTab {...controller.ranksProps} />}
              {controller.tab === 'Invite' && <InviteTab {...controller.inviteProps} />}
              {controller.tab === 'Admin' && <AdminTab {...controller.adminProps} />}
            </div>

            {controller.showLeaveFooter && (
              <div style={styles.footer}>
                <button
                  onClick={controller.onLeaveGuild}
                  style={styles.leaveBtn}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background = '#991b1b';
                    event.currentTarget.style.borderColor = '#f87171';
                    event.currentTarget.style.color = '#fee2e2';
                    event.currentTarget.style.boxShadow = '0 0 0 1px rgba(239, 68, 68, 0.24), 0 0 16px rgba(239, 68, 68, 0.24)';
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = 'rgba(127, 29, 29, 0.92)';
                    event.currentTarget.style.borderColor = '#ef4444';
                    event.currentTarget.style.color = '#fecaca';
                    event.currentTarget.style.boxShadow = '0 0 0 1px rgba(239, 68, 68, 0.16), inset 0 1px 0 rgba(255,255,255,0.04)';
                  }}
                >
                  Leave Guild
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {controller.confirmDialog && (
        <div style={styles.confirmOverlay} onClick={controller.onDismissConfirmDialog}>
          <div style={styles.confirmModal} onClick={(event) => event.stopPropagation()}>
            <h3 style={styles.confirmTitle}>{controller.confirmDialog.title}</h3>
            <p style={styles.confirmMessage}>{controller.confirmDialog.message}</p>
            <div style={styles.confirmActions}>
              <button onClick={controller.onDismissConfirmDialog} style={styles.confirmCancelBtn}>Cancel</button>
              <button
                onClick={controller.onAcceptConfirmDialog}
                style={controller.confirmDialog.danger ? styles.confirmDangerConfirmBtn : styles.confirmAcceptBtn}
              >
                {controller.confirmDialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(GuildSettingsModal);
