import React from 'react';
import { BackButton } from './LoginScreenShared.jsx';
import {
  LoginQrAdvancedSection,
  LoginQrApprovalLink,
  LoginQrInstallSection,
} from './LoginQrPanels.jsx';

export function LoginQrView({
  switchView,
  connectURI,
  qrStatusMessage,
  openExternalLink,
  error,
  authChallengeUrl,
  setQrSessionNonce,
  showQrAdvanced,
  setShowQrAdvanced,
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
  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <BackButton onClick={() => switchView('main')} />

      <div style={{ textAlign: 'center', marginBottom: 16, paddingTop: 8 }}>
        <p
          style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: 12,
            fontWeight: 400,
            letterSpacing: '2px',
            textTransform: 'uppercase',
          }}
        >
          Scan with signer
        </p>
      </div>

      <LoginQrInstallSection
        connectURI={connectURI}
        qrStatusMessage={qrStatusMessage}
        openExternalLink={openExternalLink}
      />

      {error && (
        <p style={{ color: '#ff4757', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>{error}</p>
      )}

      <LoginQrApprovalLink authChallengeUrl={authChallengeUrl} openExternalLink={openExternalLink} />

      <LoginQrAdvancedSection
        showQrAdvanced={showQrAdvanced}
        setShowQrAdvanced={setShowQrAdvanced}
        setQrSessionNonce={setQrSessionNonce}
        copyQrUri={copyQrUri}
        canCopyQrUri={canCopyQrUri}
        showBunkerInput={showBunkerInput}
        setShowBunkerInput={setShowBunkerInput}
        handleBunkerSubmit={handleBunkerSubmit}
        bunkerInput={bunkerInput}
        setBunkerInput={setBunkerInput}
        canSubmitBunker={canSubmitBunker}
        loading={loading}
        qrUriCopyState={qrUriCopyState}
      />
    </div>
  );
}
