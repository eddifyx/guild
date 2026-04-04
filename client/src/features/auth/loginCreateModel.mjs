export function getCreateKeyPrimerToggleLabel(showKeyPrimer) {
  return showKeyPrimer ? 'Hide account explainer' : 'How does this account work?';
}

export function getCreateImageButtonLabel(createImageFile) {
  return createImageFile ? 'Change profile image' : 'Choose profile image';
}

export function getCreateGenerateButtonLabel(generatedAccount) {
  return generatedAccount ? 'Generate New Keys' : 'Generate Nostr Keys';
}

export function getGeneratedNsecToggleLabel(showGeneratedNsec) {
  return showGeneratedNsec ? 'Hide' : 'Show';
}

export function getCreateCopyStateColor(createCopyState) {
  return createCopyState === 'Copy failed' ? '#ff4757' : 'rgba(64, 255, 64, 0.7)';
}

export function getCreateAccountSubmitLabel(loading) {
  return loading ? 'Signing in...' : 'Use This Account in /guild';
}

