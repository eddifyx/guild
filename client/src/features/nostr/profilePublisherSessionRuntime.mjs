import { NIP46_PROFILE_RECONNECT_TIMEOUT_MS } from '../auth/nostrConnectTimeouts.mjs';

const RECONNECT_SIGNER_TIMEOUT_MS = NIP46_PROFILE_RECONNECT_TIMEOUT_MS;
const SIGNER_APPROVAL_TIMEOUT_MS = 30000;
const SIGNER_PING_TIMEOUT_MS = 8000;
const PROFILE_PUBLISH_NIP46_COOLDOWN_STAGE = 'before_profile_publish_signature';

export { RECONNECT_SIGNER_TIMEOUT_MS };

export function withPublisherSignerTimeout(promise, timeoutMs, message, {
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeoutFn(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeoutFn(timeoutId);
  });
}

export async function resolvePublisherSignerSession({
  getSignerFn = () => null,
  getUserPubkeyFn = () => null,
  reconnectSignerFn = async () => false,
  reconnectTimeoutMs = RECONNECT_SIGNER_TIMEOUT_MS,
  reconnectTimeoutMessage = 'Signer reconnect timed out — reconnect your signer and try again',
  withTimeoutFn = withPublisherSignerTimeout,
} = {}) {
  let signer = getSignerFn?.() || null;
  let pubkey = getUserPubkeyFn?.() || null;
  let error = null;

  if (signer && pubkey) {
    return { signer, pubkey, restored: false, error: null };
  }

  let restored = false;
  try {
    restored = Boolean(await withTimeoutFn(
      Promise.resolve(reconnectSignerFn?.()),
      reconnectTimeoutMs,
      reconnectTimeoutMessage,
    ));
  } catch (nextError) {
    restored = false;
    error = nextError instanceof Error ? nextError : new Error(String(nextError));
  }

  signer = getSignerFn?.() || null;
  pubkey = getUserPubkeyFn?.() || null;
  return { signer, pubkey, restored, error };
}

export async function preparePublisherSignerRequest({
  signer = null,
  loginMode = null,
  waitForNip46RelayCooldownFn = async () => {},
  cooldownStage = PROFILE_PUBLISH_NIP46_COOLDOWN_STAGE,
  pingTimeoutMs = SIGNER_PING_TIMEOUT_MS,
  pingTimeoutMessage = 'Your signer connected, but it did not answer a basic NIP-46 ping in time.',
  ignorePingFailure = false,
  withTimeoutFn = withPublisherSignerTimeout,
} = {}) {
  if (!signer || loginMode !== 'nip46') {
    return false;
  }

  await Promise.resolve(waitForNip46RelayCooldownFn?.(cooldownStage));

  if (typeof signer.ping === 'function') {
    try {
      await withTimeoutFn(
        Promise.resolve(signer.ping()),
        pingTimeoutMs,
        pingTimeoutMessage,
      );
    } catch (error) {
      if (!ignorePingFailure) {
        throw error;
      }
    }
  }

  await Promise.resolve(waitForNip46RelayCooldownFn?.(`${cooldownStage}:after-ping`));
  return true;
}

export async function requestPublisherSignature({
  signer = null,
  eventTemplate = null,
  signEventFn = (currentSigner, template) => currentSigner?.signEvent?.(template),
  timeoutMs = SIGNER_APPROVAL_TIMEOUT_MS,
  timeoutMessage = 'Your signer connected, but it did not approve the publish request in time.',
  withTimeoutFn = withPublisherSignerTimeout,
} = {}) {
  return withTimeoutFn(
    Promise.resolve(signEventFn(signer, eventTemplate)),
    timeoutMs,
    timeoutMessage,
  );
}
