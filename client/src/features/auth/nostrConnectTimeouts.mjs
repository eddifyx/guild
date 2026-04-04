export const NIP46_SIGNER_PUBLIC_KEY_TIMEOUT_MS = 15000;

// Profile/image publish reconnects should allow the bunker reconnect lane
// to finish its own restore timeout first, plus a little room for follow-up
// state propagation back into the shared signer runtime.
export const NIP46_PROFILE_RECONNECT_TIMEOUT_MS =
  NIP46_SIGNER_PUBLIC_KEY_TIMEOUT_MS + 5000;
