export async function runWithConcurrency(items = [], limit = 1, worker = async () => {}) {
  const concurrency = Math.max(1, Math.min(limit || 1, items.length || 1));
  const results = new Array(items.length);
  let cursor = 0;

  async function runNext() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => runNext()));
  return results;
}

export function selectSenderKeyRecipients(members = [], currentUserId = null) {
  return members.filter((member) => (
    member.id !== currentUserId
    && typeof member.npub === 'string'
    && member.npub.startsWith('npub1')
  ));
}

export function buildSenderKeyDistributionPayload({
  roomId,
  senderUserId,
  skdmBase64,
} = {}) {
  return JSON.stringify({
    type: 'sender_key_distribution',
    v: 2,
    roomId,
    senderUserId,
    skdm: skdmBase64,
  });
}

export function summarizeSenderKeyDistributionResults(results = []) {
  const deliveredCount = results.filter((result) => result?.ok).length;
  const failures = results
    .filter((result) => result && !result.ok)
    .map((result) => result.member?.username || result.member?.id)
    .filter(Boolean);
  return { deliveredCount, failures };
}

export function emitSenderKeyDistributionWarning({
  roomId,
  deliveredCount,
  recipientCount,
  failures = [],
  windowObj = globalThis.window,
} = {}) {
  if (!windowObj?.dispatchEvent || typeof windowObj.CustomEvent !== 'function') return;
  windowObj.dispatchEvent(new windowObj.CustomEvent('room-sender-key-distribution-warning', {
    detail: {
      roomId,
      deliveredCount,
      recipientCount,
      failures,
    },
  }));
}

export function validateSenderKeyDistributionPayload({
  fromUserId,
  payload,
} = {}) {
  if (payload?.type !== 'sender_key_distribution') return { handled: false };
  if (payload.senderUserId !== fromUserId) {
    throw new Error(`SKDM sender mismatch: ${payload.senderUserId} vs DM sender ${fromUserId}`);
  }

  if (payload.v === 2 && payload.skdm) {
    return { handled: true, version: 2 };
  }

  if (payload.chainKey && payload.signingKeyPublic) {
    return { handled: true, version: 1 };
  }

  throw new Error('Unknown sender key distribution format');
}

export function validateLegacySenderKeyPayload({
  payload,
  fromBase64Fn,
  maxIteration,
} = {}) {
  if (typeof payload.chainKey !== 'string' || typeof payload.signingKeyPublic !== 'string') {
    throw new Error('V1 SKDM: missing chainKey or signingKeyPublic');
  }
  const chainKeyBytes = fromBase64Fn(payload.chainKey);
  const signingKeyBytes = fromBase64Fn(payload.signingKeyPublic);
  if (chainKeyBytes.length !== 32 || signingKeyBytes.length !== 32) {
    throw new Error('V1 SKDM: invalid key lengths');
  }
  if (!Number.isInteger(payload.iteration) || payload.iteration < 0 || payload.iteration > maxIteration) {
    throw new Error('V1 SKDM: invalid iteration');
  }
  return {
    chainKeyBytes,
    signingKeyBytes,
    iteration: payload.iteration,
  };
}
