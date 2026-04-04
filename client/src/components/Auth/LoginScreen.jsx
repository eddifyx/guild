import React from 'react';
import { useLoginScreenController } from '../../features/auth/useLoginScreenController.mjs';
import {
  LoginCreateView,
  LoginMainView,
  LoginNsecView,
  LoginQrView,
  LoginWelcomeView,
} from './LoginScreenViews.jsx';
import { loginScreenKeyframesCss, styles } from './LoginScreenShellStyles.mjs';

export default function LoginScreen({ onLoginSuccess }) {
  const controller = useLoginScreenController({ onLoginSuccess });

  return (
    <div style={styles.page(controller.isCreateView)}>
      <button
        onClick={() => window.electronAPI?.windowClose?.()}
        style={styles.closeButton}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#e81123';
          e.currentTarget.style.color = '#fff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'none';
          e.currentTarget.style.color = 'var(--text-muted)';
        }}
      >
        <svg width="14" height="14" viewBox="0 0 12 12">
          <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      <style>{loginScreenKeyframesCss}</style>

      <div style={styles.card(controller.isCreateView)}>
        {controller.view === 'welcome' && <LoginWelcomeView switchView={controller.switchView} />}

        {controller.view === 'create' && (
          <LoginCreateView
            switchView={controller.switchView}
            showKeyPrimer={controller.showKeyPrimer}
            setShowKeyPrimer={controller.setShowKeyPrimer}
            createName={controller.createName}
            setCreateName={controller.setCreateName}
            createAbout={controller.createAbout}
            setCreateAbout={controller.setCreateAbout}
            createPicture={controller.createPicture}
            setCreatePicture={controller.setCreatePicture}
            createImageFile={controller.createImageFile}
            createImageInputRef={controller.createImageInputRef}
            createAvatarPreview={controller.createAvatarPreview}
            handleCreateImageChange={controller.handleCreateImageChange}
            setCreateImageFile={controller.setCreateImageFile}
            generatedAccount={controller.generatedAccount}
            loading={controller.loading}
            generateAccount={controller.generateAccount}
            showGeneratedNsec={controller.showGeneratedNsec}
            setShowGeneratedNsec={controller.setShowGeneratedNsec}
            maskedGeneratedNsec={controller.maskedGeneratedNsec}
            copyGeneratedValue={controller.copyGeneratedValue}
            createCopyState={controller.createCopyState}
            error={controller.error}
            handleCreateAccountSubmit={controller.handleCreateAccountSubmit}
            canSubmitCreateAccount={controller.canSubmitCreateAccount}
            openPrimal={controller.openPrimal}
          />
        )}

        {controller.view === 'main' && (
          <LoginMainView
            switchView={controller.switchView}
            showServer={controller.showServer}
            setShowServer={controller.setShowServer}
            server={controller.server}
            setServer={controller.setServer}
            shouldWarnInsecureServer={controller.shouldWarnInsecureServer}
          />
        )}

        {controller.view === 'qr' && (
          <LoginQrView
            switchView={controller.switchView}
            connectURI={controller.connectURI}
            qrStatusMessage={controller.qrStatusMessage}
            openExternalLink={controller.openExternalLink}
            error={controller.error}
            authChallengeUrl={controller.authChallengeUrl}
            qrBusy={controller.qrBusy}
            setQrSessionNonce={controller.setQrSessionNonce}
            showQrAdvanced={controller.showQrAdvanced}
            setShowQrAdvanced={controller.setShowQrAdvanced}
            copyQrUri={controller.copyQrUri}
            canCopyQrUri={controller.canCopyQrUri}
            showBunkerInput={controller.showBunkerInput}
            setShowBunkerInput={controller.setShowBunkerInput}
            handleBunkerSubmit={controller.handleBunkerSubmit}
            bunkerInput={controller.bunkerInput}
            setBunkerInput={controller.setBunkerInput}
            canSubmitBunker={controller.canSubmitBunker}
            loading={controller.loading}
            qrUriCopyState={controller.qrUriCopyState}
          />
        )}

        {controller.view === 'nsec' && (
          <LoginNsecView
            switchView={controller.switchView}
            handleNsecSubmit={controller.handleNsecSubmit}
            nsecInput={controller.nsecInput}
            setNsecInput={controller.setNsecInput}
            error={controller.error}
            canSubmitNsec={controller.canSubmitNsec}
            loading={controller.loading}
          />
        )}
      </div>
    </div>
  );
}
