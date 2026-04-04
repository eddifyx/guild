import React from 'react';
import { inputStyle } from './LoginScreenShared.jsx';
import {
  getCreateCopyStateColor,
  getGeneratedNsecToggleLabel,
} from '../../features/auth/loginCreateModel.mjs';
import { styles } from './LoginCreateStyles.mjs';

export function LoginCreateGeneratedKeysSection({
  generatedAccount,
  showGeneratedNsec,
  setShowGeneratedNsec,
  maskedGeneratedNsec,
  copyGeneratedValue,
  createCopyState,
}) {
  if (!generatedAccount) {
    return null;
  }

  return (
    <>
      <div style={styles.generatedWarning}>
        <div style={styles.generatedWarningIconWrap}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff8f8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3l-8.47-14.14a2 2 0 0 0-3.42 0Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <p style={styles.generatedWarningTitle}>Save this nsec now.</p>
          <p style={styles.generatedWarningText}>
            Anyone with this secret key can control the account. Copy it somewhere safe before you continue.
          </p>
        </div>
      </div>

      <div style={styles.keyBlock}>
        <div style={styles.keyHeader}>
          <p style={styles.keyLabel}>Public key (npub)</p>
          <button
            type="button"
            onClick={() => copyGeneratedValue(generatedAccount.npub, 'npub copied')}
            style={styles.keyCopyButton}
          >
            Copy
          </button>
        </div>
        <div
          style={{
            ...inputStyle,
            marginBottom: 0,
            ...styles.keyValue,
          }}
        >
          {generatedAccount.npub}
        </div>
      </div>

      <div style={styles.keyBlock}>
        <div style={styles.keyHeader}>
          <p style={styles.keyLabel}>Secret key (nsec)</p>
          <div style={styles.keyActionGroup}>
            <button
              type="button"
              onClick={() => setShowGeneratedNsec((value) => !value)}
              style={styles.keyToggleButton}
            >
              {getGeneratedNsecToggleLabel(showGeneratedNsec)}
            </button>
            <button
              type="button"
              onClick={() => copyGeneratedValue(generatedAccount.nsec, 'nsec copied')}
              style={styles.keyCopyButton}
            >
              Copy
            </button>
          </div>
        </div>
        <div
          style={{
            ...inputStyle,
            marginBottom: 0,
            ...styles.keyValue,
            color: showGeneratedNsec ? '#ffe4e4' : 'rgba(255, 255, 255, 0.45)',
          }}
        >
          {showGeneratedNsec ? generatedAccount.nsec : maskedGeneratedNsec}
        </div>
      </div>

      {createCopyState && (
        <p style={{ ...styles.copyState, color: getCreateCopyStateColor(createCopyState) }}>
          {createCopyState}
        </p>
      )}
    </>
  );
}
