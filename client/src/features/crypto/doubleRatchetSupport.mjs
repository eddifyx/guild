import { hkdfSha256, hmacSha256, fromBase64, toBase64 } from '../../crypto/primitives.js';

export const MAX_SKIP = 1000;
export const MAX_SKIPPED_TOTAL = 5000;
export const MAX_COUNTER = Number.MAX_SAFE_INTEGER - 1;
export const RATCHET_INFO = 'ByzantineRatchet';

export function deriveRatchetRootAndChainKey(rootKey, dhOutput) {
  const derived = hkdfSha256(dhOutput, rootKey, RATCHET_INFO, 64);
  return [derived.slice(0, 32), derived.slice(32, 64)];
}

export function deriveRatchetChainAndMessageKey(chainKey) {
  const messageKey = hmacSha256(chainKey, new Uint8Array([0x01]));
  const newChainKey = hmacSha256(chainKey, new Uint8Array([0x02]));
  return [newChainKey, messageKey];
}

export function encodeRatchetAAD(header, senderId, recipientId) {
  const json = JSON.stringify({
    dh: header.dh,
    pn: header.pn,
    n: header.n,
    sid: senderId,
    rid: recipientId,
  });
  return new TextEncoder().encode(json);
}

export function validateRatchetHeader(header = {}) {
  if (
    !Number.isInteger(header.n)
    || header.n < 0
    || header.n > MAX_COUNTER
    || !Number.isInteger(header.pn)
    || header.pn < 0
    || header.pn > MAX_COUNTER
  ) {
    throw new Error('Invalid message header: n and pn must be non-negative integers within safe range');
  }
}

export function skipRatchetMessageKeys(state, until) {
  if (state.CKr === null) return;

  if (until - state.Nr > MAX_SKIP) {
    throw new Error(`Cannot skip more than ${MAX_SKIP} messages`);
  }

  while (state.Nr < until) {
    const CKr = fromBase64(state.CKr);
    const [newCKr, mk] = deriveRatchetChainAndMessageKey(CKr);
    CKr.fill(0);
    const skipKey = `${state.DHr}:${state.Nr}`;
    state.MKSKIPPED[skipKey] = toBase64(mk);
    state.CKr = toBase64(newCKr);
    state.Nr += 1;
    mk.fill(0);
  }

  const keys = Object.keys(state.MKSKIPPED);
  if (keys.length > MAX_SKIPPED_TOTAL) {
    const toRemove = keys.length - MAX_SKIPPED_TOTAL;
    for (let i = 0; i < toRemove; i += 1) {
      delete state.MKSKIPPED[keys[i]];
    }
  }
}
