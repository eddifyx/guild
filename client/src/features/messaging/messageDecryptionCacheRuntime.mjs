import {
  getMessageCacheMapKey,
  getMessageCiphertext,
  hashCiphertext,
  PERSISTED_MESSAGE_CACHE_TTL_MS,
  sanitizeCachedAttachments,
} from './messageDecryptionCacheModel.mjs';

const decryptedMessageCache = new Map();
const persistedDecryptedMessageCache = new Map();
const pendingPersistedMessageLoads = new Map();
const MESSAGE_CACHE_IPC_TIMEOUT_MS = 1000;

function getElectronApi(electronApi) {
  if (electronApi) return electronApi;
  if (typeof window === 'undefined') return null;
  return window.electronAPI || null;
}

function getTimeoutApi({
  setTimeoutFn,
  clearTimeoutFn,
} = {}) {
  const timeoutOwner = typeof window !== 'undefined' ? window : globalThis;
  return {
    setTimeoutFn: setTimeoutFn || timeoutOwner.setTimeout.bind(timeoutOwner),
    clearTimeoutFn: clearTimeoutFn || timeoutOwner.clearTimeout.bind(timeoutOwner),
  };
}

async function withMessageCacheTimeout(
  operation,
  {
    timeoutMs = MESSAGE_CACHE_IPC_TIMEOUT_MS,
    operationName = 'message-cache',
    setTimeoutFn,
    clearTimeoutFn,
  } = {},
) {
  const timeoutApi = getTimeoutApi({ setTimeoutFn, clearTimeoutFn });

  return new Promise((resolve, reject) => {
    const timeoutId = timeoutApi.setTimeoutFn(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    Promise.resolve()
      .then(operation)
      .then((value) => {
        timeoutApi.clearTimeoutFn(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        timeoutApi.clearTimeoutFn(timeoutId);
        reject(error);
      });
  });
}

function evictPersistedMessageCaches(userId, messageId) {
  const mapKey = getMessageCacheMapKey(userId, messageId);
  if (!mapKey) return;
  persistedDecryptedMessageCache.delete(mapKey);
  pendingPersistedMessageLoads.delete(mapKey);
}

export function deletePersistedMessageEntry(
  userId,
  messageId,
  {
    electronApi,
    warnFn = console.warn,
  } = {},
) {
  if (!userId || !messageId) return;
  evictPersistedMessageCaches(userId, messageId);
  const api = getElectronApi(electronApi);
  if (!api?.messageCacheDelete) return;

  api.messageCacheDelete(userId, messageId).catch((err) => {
    warnFn('[Messages] Failed to delete persisted decrypted cache:', err?.message || err);
  });
}

export function getCachedDecryptedMessage(msg, userId) {
  const ciphertext = getMessageCiphertext(msg);
  if (!msg?.id || !msg?.encrypted || !ciphertext || !userId) return null;
  const cacheKey = getMessageCacheMapKey(userId, msg.id);
  const cached = cacheKey ? decryptedMessageCache.get(cacheKey) : null;
  if (!cached || cached.ciphertextHash !== hashCiphertext(ciphertext)) return null;
  return cached;
}

export async function loadPersistedDecryptedMessage(
  msg,
  userId,
  {
    electronApi,
    cacheTtlMs = PERSISTED_MESSAGE_CACHE_TTL_MS,
    timeoutMs = MESSAGE_CACHE_IPC_TIMEOUT_MS,
    setTimeoutFn,
    clearTimeoutFn,
    warnFn = console.warn,
  } = {},
) {
  const ciphertext = getMessageCiphertext(msg);
  const api = getElectronApi(electronApi);
  if (!msg?.id || !msg?.encrypted || !ciphertext || !userId || !api?.messageCacheGet) return null;

  const cacheKey = getMessageCacheMapKey(userId, msg.id);
  const ciphertextHash = hashCiphertext(ciphertext);
  const cached = cacheKey ? persistedDecryptedMessageCache.get(cacheKey) : null;
  if (cached && cached.ciphertextHash === ciphertextHash) {
    decryptedMessageCache.set(cacheKey, cached);
    return cached;
  }

  if (cacheKey && pendingPersistedMessageLoads.has(cacheKey)) {
    return pendingPersistedMessageLoads.get(cacheKey);
  }

  const loadPromise = (async () => {
    try {
      const parsed = await withMessageCacheTimeout(
        () => api.messageCacheGet(userId, msg.id),
        {
          timeoutMs,
          operationName: 'message-cache:get',
          setTimeoutFn,
          clearTimeoutFn,
        },
      );
      if (!parsed) return null;

      if (parsed.ciphertextHash !== ciphertextHash) {
        deletePersistedMessageEntry(userId, msg.id, { electronApi: api, warnFn });
        return null;
      }
      if (Date.now() - (parsed.cachedAt || 0) > cacheTtlMs) {
        deletePersistedMessageEntry(userId, msg.id, { electronApi: api, warnFn });
        return null;
      }

      if (cacheKey) {
        persistedDecryptedMessageCache.set(cacheKey, parsed);
        decryptedMessageCache.set(cacheKey, parsed);
      }
      return parsed;
    } catch (err) {
      warnFn('[Messages] Failed to load persisted decrypted cache:', err?.message || err);
      deletePersistedMessageEntry(userId, msg.id, { electronApi: api, warnFn });
      return null;
    }
  })().finally(() => {
    if (cacheKey) pendingPersistedMessageLoads.delete(cacheKey);
  });

  if (cacheKey) pendingPersistedMessageLoads.set(cacheKey, loadPromise);
  return loadPromise;
}

export async function loadPersistedDecryptedMessages(
  msgs,
  userId,
  {
    electronApi,
    timeoutMs = MESSAGE_CACHE_IPC_TIMEOUT_MS,
    setTimeoutFn,
    clearTimeoutFn,
    warnFn = console.warn,
  } = {},
) {
  const api = getElectronApi(electronApi);
  if (!Array.isArray(msgs) || msgs.length === 0 || !userId || !api?.messageCacheGetMany) {
    return new Map();
  }

  const encryptedMessages = msgs.filter((msg) => {
    const ciphertext = getMessageCiphertext(msg);
    return !!msg?.id && !!msg?.encrypted && !!ciphertext;
  });
  if (encryptedMessages.length === 0) return new Map();

  const messageIds = encryptedMessages.map((msg) => msg.id);
  let rawEntries = {};

  try {
    rawEntries = await withMessageCacheTimeout(
      () => api.messageCacheGetMany(userId, messageIds),
      {
        timeoutMs,
        operationName: 'message-cache:get-many',
        setTimeoutFn,
        clearTimeoutFn,
      },
    );
  } catch (err) {
    warnFn('[Messages] Failed to bulk load persisted decrypted cache:', err?.message || err);
    return new Map();
  }

  const results = new Map();
  for (const msg of encryptedMessages) {
    const cacheKey = getMessageCacheMapKey(userId, msg.id);
    const ciphertext = getMessageCiphertext(msg);
    const entry = rawEntries?.[msg.id];
    if (!entry || typeof entry !== 'object') continue;
    if (entry.ciphertextHash !== hashCiphertext(ciphertext)) {
      deletePersistedMessageEntry(userId, msg.id, { electronApi: api, warnFn });
      continue;
    }

    const normalizedEntry = {
      ciphertextHash: entry.ciphertextHash,
      body: typeof entry.body === 'string' ? entry.body : '',
      attachments: Array.isArray(entry.attachments) ? entry.attachments : [],
      cachedAt: typeof entry.cachedAt === 'number' ? entry.cachedAt : Date.now(),
    };

    if (cacheKey) {
      persistedDecryptedMessageCache.set(cacheKey, normalizedEntry);
      decryptedMessageCache.set(cacheKey, normalizedEntry);
    }
    results.set(msg.id, normalizedEntry);
  }

  return results;
}

export function clearDecryptedMessageCaches({ revokeAttachmentPreviewUrlsFn } = {}) {
  if (typeof revokeAttachmentPreviewUrlsFn === 'function') {
    for (const entry of decryptedMessageCache.values()) {
      revokeAttachmentPreviewUrlsFn(entry?.attachments);
    }
    for (const entry of persistedDecryptedMessageCache.values()) {
      revokeAttachmentPreviewUrlsFn(entry?.attachments);
    }
  }

  decryptedMessageCache.clear();
  persistedDecryptedMessageCache.clear();
  pendingPersistedMessageLoads.clear();
}

export function persistDecryptedMessage(
  msg,
  body,
  attachments = [],
  userId,
  {
    electronApi,
    warnFn = console.warn,
  } = {},
) {
  const ciphertext = getMessageCiphertext(msg);
  if (!msg?.id || !msg?.encrypted || !ciphertext || !userId) return;

  const cachedAttachments = attachments || [];
  const persistedAttachments = sanitizeCachedAttachments(cachedAttachments);
  const entry = {
    ciphertextHash: hashCiphertext(ciphertext),
    body,
    attachments: cachedAttachments,
    cachedAt: Date.now(),
  };
  const cacheKey = getMessageCacheMapKey(userId, msg.id);
  if (cacheKey) {
    decryptedMessageCache.set(cacheKey, entry);
    persistedDecryptedMessageCache.set(cacheKey, entry);
  }

  const api = getElectronApi(electronApi);
  if (!api?.messageCacheSet) return;

  api.messageCacheSet(userId, msg.id, { ...entry, attachments: persistedAttachments }).catch((err) => {
    warnFn('[Messages] Failed to persist decrypted cache:', err?.message || err);
  });
}
