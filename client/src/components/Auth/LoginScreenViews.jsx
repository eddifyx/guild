import React from 'react';
import { BackButton } from './LoginScreenShared.jsx';
import { LoginCreateView } from './LoginCreateView.jsx';
import { LoginQrView } from './LoginQrView.jsx';
import { styles } from './LoginScreenViewStyles.mjs';
import {
  LoginBrandHeader,
  LoginMainActions,
  LoginNsecForm,
  LoginNsecHeader,
  LoginServerSettings,
  LoginWelcomeActions,
} from './LoginScreenViewPanels.jsx';

export { LoginCreateView, LoginQrView };

export function LoginWelcomeView({ switchView }) {
  return (
    <div style={styles.container}>
      <LoginBrandHeader>
        Bring an existing account, or generate a fresh Nostr keypair here.
      </LoginBrandHeader>
      <LoginWelcomeActions
        onLogin={() => switchView('main')}
        onCreateKey={() => switchView('create')}
      />
    </div>
  );
}

export function LoginMainView({
  switchView,
  showServer,
  setShowServer,
  server,
  setServer,
  shouldWarnInsecureServer,
}) {
  return (
    <div style={styles.container}>
      <BackButton onClick={() => switchView('welcome')} />
      <LoginBrandHeader>
        Use QR if you can. Pasting a private key stays available, but it is the riskier path.
      </LoginBrandHeader>
      <LoginMainActions
        onQr={() => switchView('qr')}
        onNsec={() => switchView('nsec')}
      />
      <LoginServerSettings
        showServer={showServer}
        setShowServer={setShowServer}
        server={server}
        setServer={setServer}
        shouldWarnInsecureServer={shouldWarnInsecureServer}
      />
    </div>
  );
}

export function LoginNsecView({
  switchView,
  handleNsecSubmit,
  nsecInput,
  setNsecInput,
  error,
  canSubmitNsec,
  loading,
}) {
  return (
    <div style={styles.container}>
      <BackButton onClick={() => switchView('main')} />
      <LoginNsecHeader />
      <LoginNsecForm
        handleNsecSubmit={handleNsecSubmit}
        nsecInput={nsecInput}
        setNsecInput={setNsecInput}
        error={error}
        canSubmitNsec={canSubmitNsec}
        loading={loading}
      />
    </div>
  );
}
