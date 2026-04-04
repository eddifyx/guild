export async function resolveSignalBundleAttestationSignerSession({
  getSignerFn = () => null,
  getUserPubkeyFn = () => null,
  reconnectSignerFn = async () => false,
} = {}) {
  let signer = getSignerFn?.() || null;
  let pubkey = getUserPubkeyFn?.() || null;

  if (signer?.signEvent && pubkey) {
    return { signer, pubkey, restored: false };
  }

  let restored = false;
  try {
    restored = Boolean(await reconnectSignerFn?.());
  } catch {
    restored = false;
  }

  signer = getSignerFn?.() || null;
  pubkey = getUserPubkeyFn?.() || null;
  return { signer, pubkey, restored };
}
