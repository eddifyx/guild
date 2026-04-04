import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

const CREATE_PROFILE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export function sanitizeLoginScreenNsecErrorMessage(error) {
  let message = error?.message || 'Failed to connect';
  if (message.includes('checksum') || (message.includes('Invalid') && message.includes('nsec'))) {
    message = 'Invalid key — please check for typos and try again.';
  }
  return message;
}

export function sanitizeLoginScreenCreateAccountErrorMessage(error) {
  let message = error?.message || 'Failed to create key';
  if (/profile picture must be an http\(s\) url/i.test(message)) {
    message = 'Profile picture URL must start with http:// or https://';
  }
  return message;
}

export function buildLoginScreenDerivedState({
  loading = false,
  qrPhase = 'idle',
  generatedAccount = null,
  createImagePreview = '',
  createPicture = '',
} = {}) {
  return {
    qrBusy: loading || qrPhase === 'waiting_connection' || qrPhase === 'finishing_login',
    maskedGeneratedNsec: generatedAccount?.nsec
      ? `${generatedAccount.nsec.slice(0, 12)}${'*'.repeat(24)}${generatedAccount.nsec.slice(-8)}`
      : '',
    createAvatarPreview: createImagePreview || createPicture,
  };
}

export function createGeneratedLoginScreenAccount({
  generateSecretKeyFn = generateSecretKey,
  getPublicKeyFn = getPublicKey,
  nip19Object = nip19,
} = {}) {
  const secretKey = generateSecretKeyFn();
  const pubkey = getPublicKeyFn(secretKey);
  return {
    nsec: nip19Object.nsecEncode(secretKey),
    npub: nip19Object.npubEncode(pubkey),
  };
}

export function resetLoginScreenView({
  nextView = 'welcome',
  setErrorFn = () => {},
  setLoadingFn = () => {},
  setCreateCopyStateFn = () => {},
  setQrPhaseFn = () => {},
  setQrUriCopyStateFn = () => {},
  setShowQrAdvancedFn = () => {},
  setShowBunkerInputFn = () => {},
  setBunkerInputFn = () => {},
  setViewFn = () => {},
} = {}) {
  setErrorFn('');
  setLoadingFn(false);
  setCreateCopyStateFn('');
  setQrPhaseFn('idle');
  setQrUriCopyStateFn('');
  setShowQrAdvancedFn(false);
  setShowBunkerInputFn(false);
  if (nextView === 'qr') {
    setBunkerInputFn('');
  }
  setViewFn(nextView);
  return nextView;
}

export async function copyLoginScreenValue({
  value = '',
  successLabel = 'Copied',
  failureLabel = 'Copy failed',
  writeTextFn = async () => {},
  setCopyStateFn = () => {},
} = {}) {
  if (!value) return false;
  try {
    await writeTextFn(value);
    setCopyStateFn(successLabel);
    return true;
  } catch {
    setCopyStateFn(failureLabel);
    return false;
  }
}

export function stopLoginScreenQrSession({
  abortRef = { current: null },
  setQrPhaseFn = () => {},
} = {}) {
  if (abortRef?.current) {
    abortRef.current.abort();
    abortRef.current = null;
  }
  setQrPhaseFn('idle');
  return true;
}

export function handleLoginScreenCreateImageSelection({
  event = null,
  setErrorFn = () => {},
  setCreateImageFileFn = () => {},
  maxBytes = CREATE_PROFILE_IMAGE_MAX_BYTES,
} = {}) {
  const file = event?.target?.files?.[0];
  if (!file) return false;
  if (file.size > maxBytes) {
    setErrorFn('Profile image must be under 10MB');
    if (event?.target) {
      event.target.value = '';
    }
    return false;
  }
  setErrorFn('');
  setCreateImageFileFn(file);
  return true;
}

export async function submitLoginScreenNsec({
  value = '',
  server = '',
  getServerUrlFn = () => '',
  setServerUrlFn = () => {},
  nsecLoginFn = async () => {},
  onLoginSuccessFn = () => {},
  setLoadingFn = () => {},
  setErrorFn = () => {},
} = {}) {
  const trimmed = String(value || '').trim();
  if (!trimmed.startsWith('nsec1')) return false;

  setLoadingFn(true);
  setErrorFn('');
  try {
    if (server !== getServerUrlFn()) setServerUrlFn(server);
    await nsecLoginFn(trimmed);
    onLoginSuccessFn?.();
    return true;
  } catch (error) {
    setErrorFn(sanitizeLoginScreenNsecErrorMessage(error));
    return false;
  } finally {
    setLoadingFn(false);
  }
}

export async function submitLoginScreenBunker({
  event = null,
  bunkerInput = '',
  stopQrSessionFn = () => {},
  setLoadingFn = () => {},
  setErrorFn = () => {},
  setAuthChallengeUrlFn = () => {},
  server = '',
  getServerUrlFn = () => '',
  setServerUrlFn = () => {},
  nostrLoginFn = async () => {},
  onLoginSuccessFn = () => {},
} = {}) {
  event?.preventDefault?.();
  const trimmed = String(bunkerInput || '').trim();
  if (!trimmed) return false;

  stopQrSessionFn();
  setLoadingFn(true);
  setErrorFn('');
  setAuthChallengeUrlFn('');

  try {
    if (server !== getServerUrlFn()) setServerUrlFn(server);
    await nostrLoginFn(trimmed);
    onLoginSuccessFn?.();
    return true;
  } catch (error) {
    setErrorFn(error?.message || 'Bunker connection failed');
    return false;
  } finally {
    setLoadingFn(false);
  }
}

export async function submitLoginScreenCreateAccount({
  generatedAccount = null,
  server = '',
  getServerUrlFn = () => '',
  setServerUrlFn = () => {},
  createAccountFn = async () => {},
  profile = {},
  profileImageFile = null,
  onLoginSuccessFn = () => {},
  setLoadingFn = () => {},
  setErrorFn = () => {},
} = {}) {
  if (!generatedAccount?.nsec) return false;

  setLoadingFn(true);
  setErrorFn('');
  try {
    if (server !== getServerUrlFn()) setServerUrlFn(server);
    await createAccountFn({
      nsec: generatedAccount.nsec,
      profile,
      profileImageFile,
    });
    onLoginSuccessFn?.();
    return true;
  } catch (error) {
    setErrorFn(sanitizeLoginScreenCreateAccountErrorMessage(error));
    return false;
  } finally {
    setLoadingFn(false);
  }
}
