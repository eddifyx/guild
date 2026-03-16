const { verifyNostrEvent, npubToPubkey } = require('./nostrVerify');

const BUNDLE_ATTESTATION_KIND = 27235;
const BUNDLE_ATTESTATION_COMPAT_KIND = 1;
const BUNDLE_ATTESTATION_SCOPE = 'byzantine-signal-bundle-v1';
const BUNDLE_ATTESTATION_COMPAT_CLIENT = '/guild';

function normalizeSignedPreKey(signedPreKey) {
  return {
    keyId: signedPreKey?.keyId,
    publicKey: signedPreKey?.publicKey,
    signature: signedPreKey?.signature,
  };
}

function buildBundleAttestationPayload(bundle) {
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

function verifyBundleAttestationEvent(event, bundle, expectedNpub = null) {
  if (!event || typeof event !== 'object') return false;
  if (!verifyNostrEvent(event)) return false;
  if (![BUNDLE_ATTESTATION_KIND, BUNDLE_ATTESTATION_COMPAT_KIND].includes(event.kind)) return false;
  if (!hasBundleScopeTag(event.tags)) return false;
  if (event.kind === BUNDLE_ATTESTATION_COMPAT_KIND && !hasCompatClientTag(event.tags)) return false;
  if (event.content !== buildBundleAttestationPayload(bundle)) return false;

  if (expectedNpub) {
    try {
      if (event.pubkey !== npubToPubkey(expectedNpub)) return false;
    } catch {
      return false;
    }
  }

  return true;
}

module.exports = {
  BUNDLE_ATTESTATION_KIND,
  BUNDLE_ATTESTATION_COMPAT_KIND,
  BUNDLE_ATTESTATION_SCOPE,
  buildBundleAttestationPayload,
  verifyBundleAttestationEvent,
};
