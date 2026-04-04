export function shouldWarnInsecureLoginServer(server = '') {
  return server.startsWith('http://') && !/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d|10\.\d)/i.test(server);
}

export function getLoginScreenQrStatusMessage({
  qrPhase = 'idle',
  loading = false,
} = {}) {
  if (qrPhase === 'waiting_connection') {
    return 'Waiting for signer to connect...';
  }
  if (loading || qrPhase === 'finishing_login') {
    return 'Finishing sign-in...';
  }
  return 'Open a signer app and scan this code';
}

export function getLoginScreenServerToggleLabel(showServer) {
  return showServer ? 'Hide server settings' : 'Server settings';
}

export function getLoginScreenNsecSubmitLabel(loading) {
  return loading ? 'Connecting...' : 'Connect';
}

export function buildLoginScreenFormState({
  server = '',
  loading = false,
  qrPhase = 'idle',
  generatedAccount = null,
  createImagePreview = '',
  createPicture = '',
  bunkerInput = '',
  nsecInput = '',
  connectURI = '',
} = {}) {
  const qrBusy = loading || qrPhase === 'waiting_connection' || qrPhase === 'finishing_login';
  const maskedGeneratedNsec = generatedAccount?.nsec
    ? `${generatedAccount.nsec.slice(0, 12)}${'*'.repeat(24)}${generatedAccount.nsec.slice(-8)}`
    : '';

  return {
    qrBusy,
    qrStatusMessage: getLoginScreenQrStatusMessage({ qrPhase, loading }),
    maskedGeneratedNsec,
    createAvatarPreview: createImagePreview || createPicture,
    canCopyQrUri: !!connectURI,
    canSubmitBunker: !loading && String(bunkerInput || '').trim().length > 0,
    canSubmitNsec: !loading && String(nsecInput || '').trim().startsWith('nsec1'),
    canSubmitCreateAccount: !loading && !!generatedAccount,
    shouldWarnInsecureServer: shouldWarnInsecureLoginServer(server),
  };
}
