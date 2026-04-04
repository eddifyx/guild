import React from 'react';
import { getCreateAccountSubmitLabel } from '../../features/auth/loginCreateModel.mjs';
import { styles } from './LoginCreateStyles.mjs';

export function LoginCreateActions({
  error,
  loading,
  canSubmitCreateAccount,
  onSubmit,
  openPrimal,
}) {
  return (
    <>
      {error && <p style={styles.error}>{error}</p>}

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmitCreateAccount}
        style={{
          ...styles.submitButton,
          background: !canSubmitCreateAccount ? '#151a15' : '#40FF40',
          color: !canSubmitCreateAccount ? '#506050' : '#050705',
          cursor: loading ? 'wait' : canSubmitCreateAccount ? 'pointer' : 'default',
        }}
      >
        {getCreateAccountSubmitLabel(loading)}
      </button>

      <button type="button" onClick={openPrimal} style={styles.browserButton}>
        Prefer browser signup? Open Primal
      </button>
    </>
  );
}
