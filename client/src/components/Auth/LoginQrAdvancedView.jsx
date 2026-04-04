import React from 'react';
import { inputStyle } from './LoginScreenShared.jsx';
import {
  LOGIN_QR_BUNKER_HINT,
  LOGIN_QR_COPY_URI_LABEL,
  LOGIN_QR_REFRESH_LABEL,
} from '../../features/auth/loginQrModel.mjs';
import { buildLoginQrAdvancedState } from '../../features/auth/loginQrPanelsModel.mjs';

export function LoginQrAdvancedSection({
  qrBusy,
  showQrAdvanced,
  setShowQrAdvanced,
  setQrSessionNonce,
  copyQrUri,
  canCopyQrUri,
  showBunkerInput,
  setShowBunkerInput,
  handleBunkerSubmit,
  bunkerInput,
  setBunkerInput,
  canSubmitBunker,
  loading,
  qrUriCopyState,
}) {
  const advancedState = buildLoginQrAdvancedState({
    qrBusy,
    showQrAdvanced,
    canCopyQrUri,
    showBunkerInput,
    canSubmitBunker,
    loading,
    qrUriCopyState,
  });

  return (
    <div
      style={{
        marginTop: 10,
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(255, 255, 255, 0.02)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 10,
        }}
      >
        <button
          type="button"
          onClick={() => setQrSessionNonce((value) => value + 1)}
          disabled={advancedState.refreshDisabled}
          style={{
            background: 'none',
            border: 'none',
            color: advancedState.refreshDisabled
              ? 'rgba(64, 255, 64, 0.2)'
              : 'rgba(64, 255, 64, 0.55)',
            cursor: advancedState.refreshDisabled ? 'default' : 'pointer',
            fontSize: 12,
            padding: 6,
            transition: 'color 0.2s',
          }}
          onMouseEnter={(event) => {
            if (!advancedState.refreshDisabled) {
              event.currentTarget.style.color = 'rgba(64, 255, 64, 0.9)';
            }
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.color = advancedState.refreshDisabled
              ? 'rgba(64, 255, 64, 0.2)'
              : 'rgba(64, 255, 64, 0.55)';
          }}
        >
          {LOGIN_QR_REFRESH_LABEL}
        </button>

        <button
          type="button"
          onClick={() => setShowQrAdvanced((value) => !value)}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.45)',
            cursor: 'pointer',
            fontSize: 12,
            padding: 6,
            transition: 'color 0.2s',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.color = 'rgba(255, 255, 255, 0.45)';
          }}
        >
          {advancedState.advancedToggleLabel}
        </button>
      </div>

      {showQrAdvanced && (
        <div
          style={{
            marginTop: 10,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <form onSubmit={handleBunkerSubmit}>
            <p
              style={{
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: 11,
                lineHeight: 1.5,
                marginTop: 0,
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              {LOGIN_QR_BUNKER_HINT}
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 10,
              }}
            >
              <button
                type="button"
                onClick={copyQrUri}
                disabled={advancedState.copyDisabled}
                style={{
                  background: 'none',
                  border: 'none',
                  color: advancedState.copyDisabled
                    ? 'rgba(255, 255, 255, 0.22)'
                    : 'rgba(255, 255, 255, 0.58)',
                  cursor: advancedState.copyDisabled ? 'default' : 'pointer',
                  fontSize: 11,
                  padding: 6,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(event) => {
                  if (!advancedState.copyDisabled) {
                    event.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                  }
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.color = advancedState.copyDisabled
                    ? 'rgba(255, 255, 255, 0.22)'
                    : 'rgba(255, 255, 255, 0.58)';
                }}
              >
                {LOGIN_QR_COPY_URI_LABEL}
              </button>

              <button
                type="button"
                onClick={() => setShowBunkerInput((value) => !value)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.58)',
                  cursor: 'pointer',
                  fontSize: 11,
                  padding: 6,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.color = 'rgba(255, 255, 255, 0.58)';
                }}
              >
                {advancedState.bunkerToggleLabel}
              </button>
            </div>

            <input
              type="text"
              placeholder="bunker://... or user@domain.com"
              value={bunkerInput}
              onChange={(event) => setBunkerInput(event.target.value)}
              className="login-input"
              style={{ ...inputStyle, marginBottom: 10, fontSize: 12, fontFamily: 'monospace' }}
              onFocus={(event) => {
                event.target.style.borderColor = 'rgba(64, 255, 64, 0.3)';
              }}
              onBlur={(event) => {
                event.target.style.borderColor = 'rgba(64, 255, 64, 0.07)';
              }}
            />

            <button
              type="submit"
              disabled={advancedState.submitDisabled}
              style={{
                width: '100%',
                padding: '11px 0',
                borderRadius: 8,
                border: 'none',
                background: advancedState.submitDisabled ? '#151a15' : '#40FF40',
                color: advancedState.submitDisabled ? '#506050' : '#050705',
                fontSize: 12,
                fontWeight: 600,
                cursor: advancedState.submitDisabled ? 'default' : 'pointer',
              }}
            >
              {advancedState.submitLabel}
            </button>
          </form>

          {advancedState.showCopyState && (
            <p
              style={{
                color: 'rgba(255, 255, 255, 0.45)',
                fontSize: 11,
                marginTop: 4,
                marginBottom: 0,
                textAlign: 'center',
              }}
            >
              {advancedState.qrUriCopyState}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
