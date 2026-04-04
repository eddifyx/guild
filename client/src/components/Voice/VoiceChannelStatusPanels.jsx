import React from 'react';
import Modal from '../Common/Modal';

export function VoiceStatusNotice({ proactiveVoiceNotice, showVoiceRecoveryState, refreshVoiceStatus }) {
  if (!proactiveVoiceNotice || showVoiceRecoveryState) {
    return null;
  }

  return (
    <div
      style={{
        padding: '8px 12px',
        fontSize: 11,
        color: proactiveVoiceNotice.tone === 'warning' ? 'var(--warning)' : 'var(--danger)',
        background: proactiveVoiceNotice.tone === 'warning' ? 'rgba(255, 184, 77, 0.12)' : 'rgba(255, 71, 87, 0.1)',
        border: `1px solid ${proactiveVoiceNotice.tone === 'warning' ? 'rgba(255, 184, 77, 0.28)' : 'rgba(255, 71, 87, 0.2)'}`,
        borderRadius: 4,
        margin: '0 0 8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontWeight: 600 }}>
          {proactiveVoiceNotice.title}
        </div>
        <button
          onClick={() => {
            refreshVoiceStatus().catch(() => {});
          }}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 11,
            padding: 0,
          }}
        >
          Check again
        </button>
      </div>
      <div style={{ marginTop: 4, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        {proactiveVoiceNotice.detail}
      </div>
    </div>
  );
}

export function VoiceJoinErrorNotice({ joinError, showVoiceRecoveryState, voiceRecoveryHint }) {
  if (!joinError) {
    return null;
  }

  return (
    <div
      style={{
        padding: '8px 12px',
        fontSize: 11,
        color: showVoiceRecoveryState ? 'var(--warning)' : 'var(--danger)',
        background: showVoiceRecoveryState ? 'rgba(255, 184, 77, 0.12)' : 'rgba(255, 71, 87, 0.1)',
        border: `1px solid ${showVoiceRecoveryState ? 'rgba(255, 184, 77, 0.28)' : 'rgba(255, 71, 87, 0.2)'}`,
        borderRadius: 4,
        margin: '4px 0',
      }}
    >
      <div style={{ fontWeight: 600 }}>
        {joinError}
      </div>
      {voiceRecoveryHint && (
        <div style={{ marginTop: 4, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          {voiceRecoveryHint}
        </div>
      )}
    </div>
  );
}

export function VoiceRenameChannelModal({
  renameModal,
  renameDraft,
  setRenameDraft,
  renameError,
  setRenameError,
  renaming,
  channelAdminHandlers,
}) {
  if (!renameModal) {
    return null;
  }

  return (
    <Modal
      title="Rename Voice Channel"
      onClose={() => channelAdminHandlers.closeRenameModal({ renaming })}
    >
      <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
        Give "{renameModal.name}" a better name.
      </div>
      <input
        type="text"
        autoFocus
        maxLength={100}
        value={renameDraft}
        onChange={(e) => {
          setRenameDraft(e.target.value);
          if (renameError) {
            setRenameError('');
          }
        }}
        onKeyDown={async (e) => {
          if (e.key !== 'Enter') {
            return;
          }
          e.preventDefault();
          await channelAdminHandlers.submitRenameChannel({
            renameModal,
            renameDraft,
            renaming,
          });
        }}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg-input)',
          color: 'var(--text-primary)',
          fontSize: 13,
          outline: 'none',
          marginBottom: 12,
        }}
      />
      {renameError && (
        <div
          style={{
            marginBottom: 10,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#ef4444',
            fontSize: 11,
          }}
        >
          {renameError}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          type="button"
          onClick={() => channelAdminHandlers.closeRenameModal({ renaming })}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={renaming || !renameDraft.trim() || renameDraft.trim() === renameModal.name}
          onClick={async () => {
            await channelAdminHandlers.submitRenameChannel({
              renameModal,
              renameDraft,
              renaming,
            });
          }}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid rgba(64, 255, 64, 0.24)',
            background: 'rgba(64, 255, 64, 0.12)',
            color: '#40FF40',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            opacity: renaming || !renameDraft.trim() || renameDraft.trim() === renameModal.name ? 0.5 : 1,
          }}
        >
          {renaming ? 'Saving...' : 'Rename Channel'}
        </button>
      </div>
    </Modal>
  );
}

export function VoiceDeleteChannelModal({ deleteConfirm, deleteError, channelAdminHandlers }) {
  if (!deleteConfirm) {
    return null;
  }

  return (
    <Modal
      title="Delete Voice Channel"
      onClose={() => channelAdminHandlers.closeDeleteConfirm()}
    >
      <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
        Delete voice channel "{deleteConfirm.name}"? Everyone inside will be disconnected.
      </div>
      {deleteError && (
        <div
          style={{
            marginBottom: 10,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#ef4444',
            fontSize: 11,
          }}
        >
          {deleteError}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          type="button"
          onClick={() => channelAdminHandlers.closeDeleteConfirm()}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={async () => {
            await channelAdminHandlers.submitDeleteChannel(deleteConfirm);
          }}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid rgba(255, 71, 87, 0.3)',
            background: 'rgba(255, 71, 87, 0.12)',
            color: 'var(--danger)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Delete Channel
        </button>
      </div>
    </Modal>
  );
}
