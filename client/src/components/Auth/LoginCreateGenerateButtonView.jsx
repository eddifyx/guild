import React from 'react';
import { getCreateGenerateButtonLabel } from '../../features/auth/loginCreateModel.mjs';
import { styles } from './LoginCreateStyles.mjs';

export function LoginCreateGenerateButton({
  generatedAccount,
  loading,
  onGenerateAccount,
}) {
  return (
    <button
      type="button"
      onClick={onGenerateAccount}
      disabled={loading}
      style={{
        ...styles.generateButton,
        background: loading ? '#151a15' : '#40FF40',
        color: loading ? '#506050' : '#050705',
        cursor: loading ? 'wait' : 'pointer',
        marginBottom: generatedAccount ? 16 : 18,
        boxShadow: loading ? 'none' : styles.generateButton.boxShadow,
      }}
      onMouseEnter={(event) => {
        if (!loading) {
          event.currentTarget.style.background = '#33cc33';
        }
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = loading ? '#151a15' : '#40FF40';
      }}
    >
      {getCreateGenerateButtonLabel(generatedAccount)}
    </button>
  );
}
