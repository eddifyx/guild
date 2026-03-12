const OBSERVED_STORAGE_KEY = 'byzantine:user-npub-directory:v2';
const TRUSTED_STORAGE_KEY = 'byzantine:trusted-user-npub-directory:v2';

let observedCache = null;
let trustedCache = null;

function loadObject(key, cacheRef) {
  if (cacheRef.value) return cacheRef.value;
  try {
    const raw = localStorage.getItem(key);
    cacheRef.value = raw ? JSON.parse(raw) : {};
  } catch {
    cacheRef.value = {};
  }
  return cacheRef.value;
}

function saveObject(key, value, cacheRef) {
  cacheRef.value = value;
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeNpub(npub) {
  if (typeof npub !== 'string') return null;
  const normalized = npub.trim();
  if (!normalized.startsWith('npub1')) return null;
  return normalized;
}

function dispatchMismatch(userId, expectedNpub, receivedNpub) {
  window.dispatchEvent(new CustomEvent('nostr-identity-mismatch', {
    detail: { userId, expectedNpub, receivedNpub },
  }));
}

function dispatchTrustUpdate(userId, npub) {
  window.dispatchEvent(new CustomEvent('trusted-npub-updated', {
    detail: { userId, npub },
  }));
}

function getObservedDirectory() {
  return loadObject(OBSERVED_STORAGE_KEY, { get value() { return observedCache; }, set value(v) { observedCache = v; } });
}

function saveObservedDirectory(directory) {
  saveObject(OBSERVED_STORAGE_KEY, directory, { get value() { return observedCache; }, set value(v) { observedCache = v; } });
}

function getTrustedDirectory() {
  return loadObject(TRUSTED_STORAGE_KEY, { get value() { return trustedCache; }, set value(v) { trustedCache = v; } });
}

function saveTrustedDirectory(directory) {
  saveObject(TRUSTED_STORAGE_KEY, directory, { get value() { return trustedCache; }, set value(v) { trustedCache = v; } });
}

function persistObservedMapping(userId, npub, { allowReplace = false } = {}) {
  if (!userId || !npub) return false;
  const directory = getObservedDirectory();
  const existing = directory[userId];
  if (existing && existing !== npub && !allowReplace) {
    console.warn(`[Identity] Refusing to replace observed npub for ${userId}`);
    dispatchMismatch(userId, existing, npub);
    return false;
  }
  if (existing !== npub) {
    directory[userId] = npub;
    saveObservedDirectory(directory);
  }
  return true;
}

function persistTrustedMapping(userId, npub, { allowReplace = false } = {}) {
  if (!userId || !npub) return false;
  const directory = getTrustedDirectory();
  const existing = directory[userId];
  if (existing && existing !== npub && !allowReplace) {
    console.warn(`[Identity] Refusing to replace trusted npub for ${userId}`);
    dispatchMismatch(userId, existing, npub);
    return false;
  }
  if (existing !== npub) {
    directory[userId] = npub;
    saveTrustedDirectory(directory);
    dispatchTrustUpdate(userId, npub);
  }
  return true;
}

export function trustUserNpub(userId, npub) {
  const normalized = normalizeNpub(npub);
  if (!userId || !normalized) return false;

  const observedSaved = persistObservedMapping(userId, normalized, { allowReplace: true });
  if (!observedSaved) return false;

  return persistTrustedMapping(userId, normalized);
}

export function rememberUserNpub(userId, npub) {
  const normalized = normalizeNpub(npub);
  if (!userId || !normalized) return false;
  return persistObservedMapping(userId, normalized);
}

export function rememberUsers(users) {
  if (!Array.isArray(users)) return;
  for (const user of users) {
    const userId = user?.userId || user?.id || user?.other_user_id || null;
    const npub = user?.npub || user?.other_npub || null;
    rememberUserNpub(userId, npub);
  }
}

export function getRememberedNpub(userId) {
  if (!userId) return null;
  return getObservedDirectory()[userId] || null;
}

export function getTrustedNpub(userId) {
  if (!userId) return null;
  return getTrustedDirectory()[userId] || null;
}

export function getKnownNpub(userId) {
  if (!userId) return null;
  return getTrustedNpub(userId) || getRememberedNpub(userId);
}

export function hasTrustedNpub(userId) {
  return !!getTrustedNpub(userId);
}

export function hasKnownNpub(userId, npub = null) {
  const known = getKnownNpub(userId);
  if (!known) return false;
  const normalized = npub ? normalizeNpub(npub) : null;
  return normalized ? known === normalized : true;
}

export function isTrustedNpub(userId, npub = null) {
  const trusted = getTrustedNpub(userId);
  if (!trusted) return false;
  const normalized = npub ? normalizeNpub(npub) : null;
  return normalized ? trusted === normalized : true;
}
