import React from 'react';
import { inputStyle } from './LoginScreenShared.jsx';
import {
  getLoginScreenNsecSubmitLabel,
  getLoginScreenServerToggleLabel,
} from '../../features/auth/loginScreenModel.mjs';
import { styles } from './LoginScreenViewStyles.mjs';

function PrimaryButton({ style = null, ...props }) {
  return (
    <button
      {...props}
      style={{ ...styles.primaryButton, ...(style || {}) }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = '#33cc33';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = '#40FF40';
      }}
    />
  );
}

function SecondaryButton({ style = null, ...props }) {
  return (
    <button
      {...props}
      style={{ ...styles.secondaryButton, ...(style || {}) }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = 'rgba(64, 255, 64, 0.04)';
        event.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.3)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'transparent';
        event.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.15)';
      }}
    />
  );
}

export function LoginBrandHeader({ children, padded = false }) {
  return (
    <div style={padded ? styles.centeredHeaderWithTopPadding : styles.centeredHeader}>
      <div style={styles.brand}>/guild</div>
      <p style={styles.introText}>{children}</p>
    </div>
  );
}

export function LoginWelcomeActions({ onLogin, onCreateKey }) {
  return (
    <>
      <PrimaryButton type="button" onClick={onLogin} style={{ marginBottom: 10 }}>
        Login
      </PrimaryButton>

      <SecondaryButton type="button" onClick={onCreateKey} style={{ marginBottom: 16 }}>
        Create Key
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17 17 7" />
          <path d="M7 7h10v10" />
        </svg>
      </SecondaryButton>

      <p style={styles.welcomeFootnote}>
        Create Key sets up your key-based identity here in /guild.
      </p>
    </>
  );
}

export function LoginMainActions({ onQr, onNsec }) {
  return (
    <>
      <PrimaryButton type="button" onClick={onQr} style={{ marginBottom: 10 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="3" height="3" />
          <line x1="21" y1="14" x2="21" y2="14.01" />
          <line x1="21" y1="21" x2="21" y2="21.01" />
        </svg>
        Sign in with QR
      </PrimaryButton>

      <SecondaryButton type="button" onClick={onNsec} style={{ marginBottom: 20 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Sign in with key
      </SecondaryButton>
    </>
  );
}

export function LoginServerSettings({
  showServer,
  setShowServer,
  server,
  setServer,
  shouldWarnInsecureServer,
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => setShowServer(!showServer)}
        style={styles.serverToggle}
        onMouseEnter={(event) => {
          event.currentTarget.style.color = 'rgba(64, 255, 64, 0.5)';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.color = 'rgba(64, 255, 64, 0.25)';
        }}
      >
        {getLoginScreenServerToggleLabel(showServer)}
      </button>

      {showServer && (
        <>
          <input
            type="text"
            placeholder="Server URL"
            value={server}
            onChange={(event) => setServer(event.target.value)}
            className="login-input"
            style={{ ...inputStyle, fontSize: 13, marginTop: 8 }}
            onFocus={(event) => {
              event.target.style.borderColor = 'rgba(64, 255, 64, 0.3)';
            }}
            onBlur={(event) => {
              event.target.style.borderColor = 'rgba(64, 255, 64, 0.07)';
            }}
          />
          {shouldWarnInsecureServer && (
            <div style={styles.insecureServerWarning}>
              Insecure connection — this server uses unencrypted HTTP. Auth tokens and messages may be intercepted. Use HTTPS for production servers.
            </div>
          )}
        </>
      )}
    </>
  );
}

export function LoginNsecHeader() {
  return (
    <div style={styles.centeredHeaderWithTopPadding}>
      <div style={styles.iconBadge}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(64, 255, 64, 0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <p style={styles.sectionLabel}>Sign in with key</p>
    </div>
  );
}

export function LoginNsecWarning() {
  return (
    <div style={styles.warningCard}>
      <div style={styles.warningIconWrap}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff8f8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3l-8.47-14.14a2 2 0 0 0-3.42 0Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <div>
        <p style={styles.warningTitle}>Warning: Private-key login is less secure.</p>
        <p style={styles.warningText}>
          Use QR with Amber or another remote signer whenever possible. Only paste an `nsec` on a device you trust.
        </p>
      </div>
    </div>
  );
}

export function LoginNsecForm({
  handleNsecSubmit,
  nsecInput,
  setNsecInput,
  error,
  canSubmitNsec,
  loading,
}) {
  return (
    <form onSubmit={handleNsecSubmit}>
      <LoginNsecWarning />

      <input
        type="password"
        placeholder="Paste your nsec here"
        value={nsecInput}
        onChange={(event) => setNsecInput(event.target.value)}
        autoFocus
        className="login-input"
        style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13 }}
        onFocus={(event) => {
          event.target.style.borderColor = 'rgba(64, 255, 64, 0.3)';
        }}
        onBlur={(event) => {
          event.target.style.borderColor = 'rgba(64, 255, 64, 0.07)';
        }}
      />

      <p style={styles.helperText}>
        /guild never sends your raw key off this machine. Private-key logins stay in memory only for this session and are cleared when the app closes. Use QR with Amber or another remote signer whenever possible.
      </p>

      {error && <p style={styles.error}>{error}</p>}

      <button
        type="submit"
        disabled={!canSubmitNsec}
        style={{
          ...styles.submitButton,
          background: !canSubmitNsec ? '#151a15' : '#40FF40',
          color: !canSubmitNsec ? '#506050' : '#050705',
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        {getLoginScreenNsecSubmitLabel(loading)}
      </button>
    </form>
  );
}
