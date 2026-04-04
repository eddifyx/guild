import { verifyEvent, nip19 } from 'nostr-tools';
import { getLoginMode, getSigner, reconnect } from '../utils/nostrConnect.js';
import { getUserPubkey } from '../utils/nostrConnect.js';
import {
  resolveSignalBundleAttestationSignerSession,
} from '../features/crypto/signalBundleAttestationSessionRuntime.mjs';

export const BUNDLE_ATTESTATION_KIND = 27235;
export const BUNDLE_ATTESTATION_SCOPE = 'byzantine-signal-bundle-v1';
export const BUNDLE_ATTESTATION_COMPAT_KIND = 1;
const BUNDLE_ATTESTATION_COMPAT_CLIENT = '/guild';
const PRIMARY_SIGN_TIMEOUT_MS = 5000;
const FALLBACK_SIGN_TIMEOUT_MS = 12000;

function normalizeSignedPreKey(signedPreKey) {
  return {
    keyId: signedPreKey?.keyId,
    publicKey: signedPreKey?.publicKey,
    signature: signedPreKey?.signature,
  };
}

export function buildBundleAttestationPayload(bundle) {
  return JSON.stringify({
    scope: BUNDLE_ATTESTATION_SCOPE,
    identityKey: bundle.identityKey,
    registrationId: bundle.registrationId,
    signedPreKey: normalizeSignedPreKey(bundle.signedPreKey),
  });
}

function hasBundleScopeTag(tags) {
  return Array.isArray(tags) && tags.some(tag =>
    Array.isArray(tag) &&
    tag[0] === 'scope' &&
    tag[1] === BUNDLE_ATTESTATION_SCOPE
  );
}

function hasCompatClientTag(tags) {
  return Array.isArray(tags) && tags.some(tag =>
    Array.isArray(tag) &&
    tag[0] === 'client' &&
    tag[1] === BUNDLE_ATTESTATION_COMPAT_CLIENT
  );
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function buildBundleAttestationEvent(bundle, { compatibilityMode = false, pubkey = null } = {}) {
  return {
    kind: compatibilityMode ? BUNDLE_ATTESTATION_COMPAT_KIND : BUNDLE_ATTESTATION_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: compatibilityMode
      ? [['scope', BUNDLE_ATTESTATION_SCOPE], ['client', BUNDLE_ATTESTATION_COMPAT_CLIENT]]
      : [['scope', BUNDLE_ATTESTATION_SCOPE]],
    content: buildBundleAttestationPayload(bundle),
    ...(pubkey ? { pubkey } : {}),
  };
}

export async function signBundleAttestation(bundle) {
  const { signer, pubkey } = await resolveSignalBundleAttestationSignerSession({
    getSignerFn: getSigner,
    getUserPubkeyFn: getUserPubkey,
    reconnectSignerFn: reconnect,
  });
  if (!signer?.signEvent) {
    throw new Error('Nostr signer unavailable for Signal identity attestation');
  }
  if (!pubkey) {
    throw new Error('Nostr signer pubkey unavailable for Signal identity attestation');
  }

  const remoteCompatibilityMode = getLoginMode() === 'nip46';
  if (remoteCompatibilityMode) {
    try {
      return await withTimeout(
        signer.signEvent(buildBundleAttestationEvent(bundle, { pubkey })),
        PRIMARY_SIGN_TIMEOUT_MS,
        'Timed out waiting for Signal bundle attestation signature.',
      );
    } catch (primaryErr) {
      return withTimeout(
        signer.signEvent(buildBundleAttestationEvent(bundle, { compatibilityMode: true, pubkey })),
        FALLBACK_SIGN_TIMEOUT_MS,
        primaryErr?.message || 'Timed out waiting for Signal bundle attestation signature.',
      );
    }
  }

  try {
    return await withTimeout(
      signer.signEvent(buildBundleAttestationEvent(bundle, { pubkey })),
      PRIMARY_SIGN_TIMEOUT_MS,
      'Timed out waiting for Signal bundle attestation signature.',
    );
  } catch (primaryErr) {
    return withTimeout(
      signer.signEvent(buildBundleAttestationEvent(bundle, { compatibilityMode: true, pubkey })),
      FALLBACK_SIGN_TIMEOUT_MS,
      primaryErr?.message || 'Timed out waiting for Signal bundle attestation signature.',
    );
  }
}

export function verifyBundleAttestation(bundle, event, expectedNpub = null) {
  if (!event || typeof event !== 'object') return false;
  if (!verifyEvent(event)) return false;
  if (![BUNDLE_ATTESTATION_KIND, BUNDLE_ATTESTATION_COMPAT_KIND].includes(event.kind)) return false;
  if (!hasBundleScopeTag(event.tags)) return false;
  if (event.kind === BUNDLE_ATTESTATION_COMPAT_KIND && !hasCompatClientTag(event.tags)) return false;
  if (event.content !== buildBundleAttestationPayload(bundle)) return false;

  if (expectedNpub) {
    try {
      const decoded = nip19.decode(expectedNpub);
      if (decoded.type !== 'npub') return false;
      if (event.pubkey !== decoded.data) return false;
    } catch {
      return false;
    }
  }

  return true;
}

const CACHE_PREFIX = 'signal-bundle-attestation:';

export function loadCachedBundleAttestation(userId, bundle, expectedNpub = null) {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return verifyBundleAttestation(bundle, parsed, expectedNpub) ? parsed : null;
  } catch {
    return null;
  }
}

export function storeBundleAttestation(userId, event) {
  localStorage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify(event));
}
