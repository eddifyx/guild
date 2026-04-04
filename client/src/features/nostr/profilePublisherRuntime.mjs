const RELAY_PUBLISH_TIMEOUT_MS = 8000;

function withRelayPublishTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function describePublishError(error, fallback = 'Timed out publishing to relays') {
  if (error instanceof AggregateError && Array.isArray(error.errors) && error.errors.length) {
    for (const inner of error.errors) {
      if (inner instanceof Error && inner.message) return inner.message;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function publishEventToRelays({
  pool,
  relays = [],
  event,
  timeoutMs = RELAY_PUBLISH_TIMEOUT_MS,
} = {}) {
  const publishAttempts = pool.publish(relays, event);
  const attempts = Array.isArray(publishAttempts) ? publishAttempts : [];

  if (!attempts.length) {
    throw new Error('No relay publish attempts were created');
  }

  return Promise.any(
    attempts.map((attempt, index) => withRelayPublishTimeout(
      Promise.resolve(attempt),
      timeoutMs,
      `Timed out publishing to relays (${index + 1}/${attempts.length})`
    ))
  );
}

export async function publishSignedEvent({
  poolCtor,
  relays = [],
  event,
  publishEventFn = publishEventToRelays,
} = {}) {
  const pool = new poolCtor();
  try {
    await publishEventFn({ pool, relays, event });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describePublishError(error) };
  } finally {
    pool.close(relays);
  }
}

export async function fetchRelayProfile({
  poolCtor,
  relays = [],
  pubkey = null,
} = {}) {
  if (!pubkey) return null;
  const pool = new poolCtor();
  try {
    const event = await pool.get(relays, {
      kinds: [0],
      authors: [pubkey],
    });
    if (!event) return null;
    return JSON.parse(event.content);
  } catch {
    return null;
  } finally {
    pool.close(relays);
  }
}

export async function signBlossomAuthHeader({
  signer = null,
  pubkey = null,
  action,
  sha256,
  content,
  nowMs = Date.now(),
  encodeTokenFn,
} = {}) {
  if (!signer || !pubkey) {
    throw new Error('Signer not available — please re-login');
  }

  const createdAt = Math.floor(nowMs / 1000);
  const expiresAt = createdAt + (5 * 60);
  const signedEvent = await signer.signEvent({
    kind: 24242,
    created_at: createdAt,
    ...(pubkey ? { pubkey } : {}),
    tags: [
      ['t', action],
      ['x', sha256],
      ['expiration', String(expiresAt)],
      ['server', 'blossom.nostr.build'],
    ],
    content,
  });

  return `Nostr ${encodeTokenFn(JSON.stringify(signedEvent))}`;
}

export async function parseBlossomErrorResponse(res) {
  const text = await res.text().catch(() => '');
  if (!text) {
    return `Upload failed (${res.status})`;
  }

  try {
    const data = JSON.parse(text);
    return data.error || data.message || text;
  } catch {
    return text;
  }
}
