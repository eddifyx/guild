export function zeroNostrConnectKey(key) {
  if (key && typeof key.fill === 'function') {
    key.fill(0);
  }
}

export function emitNostrAuthChallenge(url, {
  eventName,
  windowObject = globalThis.window,
  customEventCtor = globalThis.CustomEvent,
} = {}) {
  if (!url || !windowObject || typeof windowObject.dispatchEvent !== 'function' || !customEventCtor) return;
  windowObject.dispatchEvent(new customEventCtor(eventName, {
    detail: { url },
  }));
}

export function buildNostrSignerParams({
  eventName,
  pushTraceFn = () => {},
  emitAuthChallengeFn = () => {},
  warnFn = () => {},
} = {}) {
  return {
    onauth: (url) => {
      pushTraceFn('signer.onauth', { url }, 'warn');
      warnFn('[NIP-46] Signer requested auth challenge:', url);
      emitAuthChallengeFn(url, { eventName });
    },
  };
}

export function withTimeout(promise, timeoutMs, message, {
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

export function sleep(ms, {
  setTimeoutFn = setTimeout,
} = {}) {
  return new Promise((resolve) => setTimeoutFn(resolve, ms));
}

export async function waitForNip46RelayCooldown({
  stage,
  delayMs = 500,
  pushTraceFn = () => {},
  sleepFn = sleep,
} = {}) {
  if (!delayMs || delayMs <= 0) return;
  pushTraceFn('relay.request.cooldown', {
    stage,
    delayMs,
  });
  await sleepFn(delayMs);
}

export async function resolveSignerPublicKey(signer, {
  source,
  knownPubkey = null,
  timeoutMessage,
  timeoutMs = 15000,
  pushTraceFn = () => {},
  redactTraceValueFn = (value) => value,
  withTimeoutFn = withTimeout,
} = {}) {
  if (knownPubkey) {
    pushTraceFn('signer.getPublicKey.skipped', {
      source,
      reason: 'using_known_user_pubkey',
      pubkey: redactTraceValueFn(knownPubkey),
    });
    return knownPubkey;
  }

  return withTimeoutFn(
    signer.getPublicKey(),
    timeoutMs,
    timeoutMessage,
  );
}

export function summarizeSignerArgs(methodName, args, {
  redactTraceValueFn = (value) => value,
  summarizeNostrEventFn = (value) => value,
} = {}) {
  switch (methodName) {
    case 'ping':
      return {};
    case 'sendRequest':
      return {
        requestMethod: args[0],
        params: args[1],
      };
    case 'signEvent':
      return { event: summarizeNostrEventFn(args[0]) };
    case 'nip04Encrypt':
    case 'nip44Encrypt':
      return {
        peerPubkey: redactTraceValueFn(args[0]),
        plaintextPreview: redactTraceValueFn(args[1]),
      };
    default:
      return {};
  }
}

export function summarizeSignerResult(methodName, result, {
  redactTraceValueFn = (value) => value,
  summarizeNostrEventFn = (value) => value,
} = {}) {
  switch (methodName) {
    case 'ping':
      return { result };
    case 'sendRequest':
      return { result };
    case 'getPublicKey':
      return { pubkey: redactTraceValueFn(result) };
    case 'signEvent':
      return { signedEvent: summarizeNostrEventFn(result) };
    case 'nip04Encrypt':
    case 'nip44Encrypt':
      return {
        ciphertextPreview: typeof result === 'string' ? result : null,
      };
    default:
      return {};
  }
}

export function buildTracingPool({
  source,
  SimplePoolCtor,
  pushTraceFn = () => {},
  redactTraceValueFn = (value) => value,
} = {}) {
  const pool = new SimplePoolCtor({
    onRelayConnectionSuccess: (url) => {
      pushTraceFn('relay.connection.success', { source, url });
    },
    onRelayConnectionFailure: (url) => {
      pushTraceFn('relay.connection.failure', { source, url }, 'warn');
    },
    onnotice: (url, message) => {
      pushTraceFn('relay.notice', {
        source,
        url,
        message,
      }, 'warn');
    },
  });

  const originalSubscribe = pool.subscribe.bind(pool);
  pool.subscribe = (relays, filter, params = {}, ...rest) => {
    const tracedFilter = {
      kinds: filter?.kinds || [],
      authors: filter?.authors || [],
      p: filter?.['#p'] || [],
    };

    return originalSubscribe(
      relays,
      filter,
      {
        ...params,
        onevent: (event) => {
          pushTraceFn('relay.subscription.event', {
            source,
            relays,
            filter: tracedFilter,
            event: {
              kind: event?.kind,
              created_at: event?.created_at,
              pubkey: redactTraceValueFn(event?.pubkey),
              tags: Array.isArray(event?.tags) ? event.tags : [],
              contentLength: typeof event?.content === 'string' ? event.content.length : null,
            },
          });

          if (typeof params.onevent === 'function') {
            return params.onevent(event);
          }

          return undefined;
        },
        onclose: (reason) => {
          pushTraceFn('relay.subscription.closed', {
            source,
            relays,
            filter: tracedFilter,
            reason: reason || null,
          }, 'warn');

          if (typeof params.onclose === 'function') {
            return params.onclose(reason);
          }

          return undefined;
        },
      },
      ...rest,
    );
  };

  return pool;
}

export function instrumentSigner(signer, {
  source,
  pushTraceFn = () => {},
  summarizeErrorFn = (error) => ({ message: error?.message || String(error) }),
  summarizeSignerArgsFn = summarizeSignerArgs,
  summarizeSignerResultFn = summarizeSignerResult,
  nowFn = () => Date.now(),
} = {}) {
  if (!signer || signer.__guildTraceWrapped) return signer;

  Object.defineProperty(signer, '__guildTraceWrapped', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  const wrapMethod = (methodName) => {
    if (typeof signer[methodName] !== 'function') return;

    const original = signer[methodName].bind(signer);
    signer[methodName] = async (...args) => {
      const startedAt = nowFn();
      pushTraceFn(`signer.${methodName}.request`, {
        source,
        ...summarizeSignerArgsFn(methodName, args),
      });

      try {
        const result = await original(...args);
        pushTraceFn(`signer.${methodName}.response`, {
          source,
          durationMs: nowFn() - startedAt,
          ...summarizeSignerResultFn(methodName, result),
        });
        return result;
      } catch (error) {
        pushTraceFn(`signer.${methodName}.error`, {
          source,
          durationMs: nowFn() - startedAt,
          error: summarizeErrorFn(error),
        }, 'error');
        throw error;
      }
    };
  };

  wrapMethod('connect');
  wrapMethod('close');
  wrapMethod('sendRequest');
  wrapMethod('getPublicKey');
  wrapMethod('ping');
  wrapMethod('signEvent');
  wrapMethod('nip04Encrypt');
  wrapMethod('nip44Encrypt');

  return signer;
}
