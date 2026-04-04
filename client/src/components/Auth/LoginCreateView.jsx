import React from 'react';
import { BackButton } from './LoginScreenShared.jsx';
import { styles } from './LoginCreateStyles.mjs';
import {
  LoginCreateActions,
  LoginCreateGenerateButton,
  LoginCreateGeneratedKeysSection,
  LoginCreateHeader,
  LoginCreateIdentitySection,
  LoginCreatePrimer,
  LoginCreateProfileFields,
} from './LoginCreatePanels.jsx';

export function LoginCreateView({
  switchView,
  showKeyPrimer,
  setShowKeyPrimer,
  createName,
  setCreateName,
  createAbout,
  setCreateAbout,
  createPicture,
  setCreatePicture,
  createImageFile,
  createImageInputRef,
  createAvatarPreview,
  handleCreateImageChange,
  setCreateImageFile,
  generatedAccount,
  loading,
  generateAccount,
  showGeneratedNsec,
  setShowGeneratedNsec,
  maskedGeneratedNsec,
  copyGeneratedValue,
  createCopyState,
  error,
  handleCreateAccountSubmit,
  canSubmitCreateAccount,
  openPrimal,
}) {
  return (
    <div style={styles.container}>
      <BackButton onClick={() => switchView('welcome')} />

      <LoginCreateHeader />

      <LoginCreatePrimer
        showKeyPrimer={showKeyPrimer}
        setShowKeyPrimer={setShowKeyPrimer}
      />

      <LoginCreateIdentitySection
        createName={createName}
        createImageFile={createImageFile}
        createImageInputRef={createImageInputRef}
        createAvatarPreview={createAvatarPreview}
        handleCreateImageChange={handleCreateImageChange}
        setCreateImageFile={setCreateImageFile}
      />

      <LoginCreateProfileFields
        createName={createName}
        setCreateName={setCreateName}
        createAbout={createAbout}
        setCreateAbout={setCreateAbout}
        createPicture={createPicture}
        setCreatePicture={setCreatePicture}
      />

      <LoginCreateGenerateButton
        generatedAccount={generatedAccount}
        loading={loading}
        onGenerateAccount={generateAccount}
      />

      <LoginCreateGeneratedKeysSection
        generatedAccount={generatedAccount}
        showGeneratedNsec={showGeneratedNsec}
        setShowGeneratedNsec={setShowGeneratedNsec}
        maskedGeneratedNsec={maskedGeneratedNsec}
        copyGeneratedValue={copyGeneratedValue}
        createCopyState={createCopyState}
      />

      <LoginCreateActions
        error={error}
        loading={loading}
        canSubmitCreateAccount={canSubmitCreateAccount}
        onSubmit={handleCreateAccountSubmit}
        openPrimal={openPrimal}
      />
    </div>
  );
}
