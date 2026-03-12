import { verifyEvent, nip19 } from 'nostr-tools';
import { getSigner } from '../utils/nostrConnect.js';

export const BUNDLE_ATTESTATION_KIND = 27235;
export const BUNDLE_ATTESTATION_SCOPE = 'byzantine-signal-bundle-v1';

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

export async function signBundleAttestation(bundle) {
  const signer = getSigner();
  if (!signer?.signEvent) {
    throw new Error('Nostr signer unavailable for Signal identity attestation');
  }

  return signer.signEvent({
    kind: BUNDLE_ATTESTATION_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['scope', BUNDLE_ATTESTATION_SCOPE]],
    content: buildBundleAttestationPayload(bundle),
  });
}

export function verifyBundleAttestation(bundle, event, expectedNpub = null) {
  if (!event || typeof event !== 'object') return false;
  if (!verifyEvent(event)) return false;
  if (event.kind !== BUNDLE_ATTESTATION_KIND) return false;
  if (!hasBundleScopeTag(event.tags)) return false;
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
