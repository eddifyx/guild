import { recoverRoomMessageAfterSenderKeyMiss } from './messageSenderKeyRecoveryRuntime.mjs';
import { getConversationDecryptFailureMessage } from './messageDecryptPresentation.mjs';
import { recordLaneDiagnostic } from '../../utils/laneDiagnostics.js';

const pendingSenderKeyWaits = new Map();
const reportedDecryptFailures = new Set();
const recordedDecryptDiagnostics = new Set();

export const MESSAGE_SENDER_KEY_WAIT_TIMEOUT_MS = 1500;
export const MESSAGE_DECRYPT_DIAGNOSTIC_LANE = 'message-decrypt';

function getRuntimeWindow(windowObj) {
  if (windowObj) return windowObj;
  if (typeof window !== 'undefined') return window;
  return null;
}

function getNow(nowFn) {
  return typeof nowFn === 'function' ? nowFn() : Date.now();
}

function buildDecryptedMessage(message, body, attachments) {
  return {
    ...message,
    content: body,
    _decrypted: true,
    _decryptionPending: false,
    _decryptionPendingSince: null,
    _decryptionFailed: false,
    _decryptionError: null,
    _decryptionBucket: null,
    _decryptedAttachments: attachments,
    _ciphertextContent: message?._ciphertextContent || message?.content,
  };
}

function buildPendingMessage(message, nowFn, bucket = message?._decryptionBucket || null) {
  return {
    ...message,
    content: null,
    _decryptionPending: true,
    _decryptionPendingSince: message?._decryptionPendingSince || getNow(nowFn),
    _decryptionFailed: false,
    _decryptionError: null,
    _decryptionBucket: bucket,
    _ciphertextContent: message?._ciphertextContent || message?.content,
  };
}

function buildFailedMessage(message, bucket = message?._decryptionBucket || null) {
  return {
    ...message,
    content: null,
    _decryptionFailed: true,
    _decryptionError: getConversationDecryptFailureMessage(bucket),
    _decryptionBucket: bucket,
    _ciphertextContent: message?._ciphertextContent || message?.content,
  };
}

function buildPersistedMessage(message, persisted) {
  return buildDecryptedMessage(message, persisted.body, persisted.attachments);
}

function getConversationDecryptRoute(message) {
  return message?.room_id ? 'room' : 'dm';
}

function getConversationDecryptState(message) {
  if (message?._decryptionPending) return 'pending';
  if (message?._decryptionFailed) return 'failed';
  return null;
}

export function clearMessageDecryptRuntime() {
  pendingSenderKeyWaits.clear();
  reportedDecryptFailures.clear();
  recordedDecryptDiagnostics.clear();
}

export function isExpectedHistoricalDecryptError(error) {
  const message = error?.message || String(error || '');
  return message.includes('missing sender key state')
    || message.includes('session with ')
    || message.includes('invalid Whisper message')
    || message.includes('untrusted identity')
    || message.includes('DuplicatedMessage')
    || message.includes('old counter')
    || message.includes('No DM copy available')
    || (message.includes('loadPreKey') && message.includes('PreKey') && message.includes('not found'));
}

export function shouldKeepConversationDecryptPending({
  message,
  error,
} = {}) {
  if (!message?.encrypted) return false;

  return classifyConversationDecryptFailure({ error }) !== 'other';
}

export function classifyConversationDecryptFailure({
  error,
} = {}) {
  const detail = error?.message || String(error || '');

  if (
    detail.includes('E2E encryption not initialized')
    || detail.includes('E2E not initialized yet')
  ) {
    return 'e2e-not-ready';
  }

  if (detail.includes('missing sender key state')) {
    return 'missing-sender-key';
  }

  if (detail.includes('No DM copy available')) {
    return 'missing-dm-copy';
  }

  if (
    detail.includes('Secure messaging is waiting for this contact\'s Nostr identity.')
    || detail.includes('untrusted identity')
  ) {
    return 'untrusted-identity';
  }

  if (
    detail.includes('session with ')
    || (detail.includes('loadPreKey') && detail.includes('PreKey') && detail.includes('not found'))
  ) {
    return 'missing-session';
  }

  return 'other';
}

export function recordConversationDecryptDiagnostic({
  message,
  event,
  error,
  bucket = null,
  quiet = false,
  recoveredVia = null,
  recordLaneDiagnosticFn = recordLaneDiagnostic,
} = {}) {
  if (!message?.encrypted || !event || typeof recordLaneDiagnosticFn !== 'function') {
    return null;
  }

  const previousState = getConversationDecryptState(message);
  const resolvedBucket = bucket || classifyConversationDecryptFailure({ error });
  const diagnosticKey = [
    message?.id || 'unknown',
    event,
    resolvedBucket || 'none',
    previousState || 'none',
    recoveredVia || 'none',
  ].join(':');

  if (recordedDecryptDiagnostics.has(diagnosticKey)) {
    return null;
  }
  recordedDecryptDiagnostics.add(diagnosticKey);

  return recordLaneDiagnosticFn(MESSAGE_DECRYPT_DIAGNOSTIC_LANE, `conversation-decrypt-${event}`, {
    messageId: message?.id || null,
    route: getConversationDecryptRoute(message),
    roomId: message?.room_id || null,
    senderUserId: message?.sender_id || null,
    dmPartnerId: message?.dm_partner_id || null,
    bucket: resolvedBucket || null,
    recoverable: resolvedBucket ? resolvedBucket !== 'other' : undefined,
    previousState,
    recoveredVia,
    quiet: quiet || undefined,
    reason: error?.message || undefined,
  });
}

export function reportDecryptFailure({
  message,
  error,
  quiet = false,
  errorFn = console.error,
} = {}) {
  const key = `${message?.id || 'unknown'}:${error?.message || String(error || '')}`;
  if (reportedDecryptFailures.has(key)) return;
  reportedDecryptFailures.add(key);
  if (quiet || isExpectedHistoricalDecryptError(error)) return;
  errorFn?.('Decryption failed for message', message?.id, error);
}

export async function waitForSenderKeyUpdate({
  roomId,
  timeoutMs = MESSAGE_SENDER_KEY_WAIT_TIMEOUT_MS,
  windowObj,
} = {}) {
  if (!roomId) return false;
  if (pendingSenderKeyWaits.has(roomId)) return pendingSenderKeyWaits.get(roomId);

  const runtimeWindow = getRuntimeWindow(windowObj);
  if (!runtimeWindow?.addEventListener || !runtimeWindow?.removeEventListener) return false;

  const setTimeoutFn = runtimeWindow.setTimeout?.bind(runtimeWindow) || globalThis.setTimeout.bind(globalThis);
  const clearTimeoutFn = runtimeWindow.clearTimeout?.bind(runtimeWindow) || globalThis.clearTimeout.bind(globalThis);

  const promise = new Promise((resolve) => {
    const timeoutId = setTimeoutFn(() => {
      runtimeWindow.removeEventListener('sender-key-updated', onUpdate);
      resolve(false);
    }, timeoutMs);

    const onUpdate = (event) => {
      if (event?.detail?.roomId !== roomId) return;
      clearTimeoutFn(timeoutId);
      runtimeWindow.removeEventListener('sender-key-updated', onUpdate);
      resolve(true);
    };

    runtimeWindow.addEventListener('sender-key-updated', onUpdate);
  }).finally(() => {
    pendingSenderKeyWaits.delete(roomId);
  });

  pendingSenderKeyWaits.set(roomId, promise);
  return promise;
}

async function decryptRoomMessage({
  message,
  userId,
  decryptGroupMessageFn,
  persistDecryptedMessageFn,
}) {
  const ciphertext = message?._ciphertextContent || message?.content;
  const decrypted = await decryptGroupMessageFn(message.room_id, message.sender_id, ciphertext);
  persistDecryptedMessageFn?.(message, decrypted.body, decrypted.attachments, userId);
  return buildDecryptedMessage(message, decrypted.body, decrypted.attachments);
}

async function decryptDMMessage({
  message,
  userId,
  decryptDirectMessageFn,
  persistDecryptedMessageFn,
}) {
  const ciphertext = message?._ciphertextContent || message?.content;
  const decrypted = await decryptDirectMessageFn(message.sender_id, ciphertext);
  persistDecryptedMessageFn?.(message, decrypted.body, decrypted.attachments, userId);
  return buildDecryptedMessage(message, decrypted.body, decrypted.attachments);
}

export async function tryDecryptConversationMessage({
  message,
  userId,
  retryState = null,
  options = {},
  nowFn = Date.now,
  isE2EInitializedFn,
  getCachedDecryptedMessageFn,
  loadPersistedDecryptedMessageFn,
  rememberUserNpubFn,
  decryptGroupMessageFn,
  decryptDirectMessageFn,
  persistDecryptedMessageFn,
  flushPendingControlMessagesNowFn,
  syncRoomSenderKeysFn,
  requestRoomSenderKeyFn,
  waitForSenderKeyUpdateFn = waitForSenderKeyUpdate,
  reportDecryptFailureFn = reportDecryptFailure,
  recordDecryptDiagnosticFn = recordConversationDecryptDiagnostic,
  windowObj,
} = {}) {
  const ciphertext = message?._ciphertextContent || message?.content;
  if (!message?.encrypted || !ciphertext) {
    return message;
  }

  const isE2EReady = !!isE2EInitializedFn?.();

  const persistedEntriesWerePreloaded = options.persistedEntriesById instanceof Map;

  const cached = getCachedDecryptedMessageFn?.(message, userId);
  if (cached) {
    const result = buildPersistedMessage(message, cached);
    if (getConversationDecryptState(message)) {
      recordDecryptDiagnosticFn?.({
        message,
        event: 'recovered',
        recoveredVia: 'cache',
      });
    }
    return result;
  }

  const preloadedPersisted = message?.id ? options.persistedEntriesById?.get?.(message.id) : null;
  if (preloadedPersisted) {
    const result = buildPersistedMessage(message, preloadedPersisted);
    if (getConversationDecryptState(message)) {
      recordDecryptDiagnosticFn?.({
        message,
        event: 'recovered',
        recoveredVia: 'persisted',
      });
    }
    return result;
  }

  if (!persistedEntriesWerePreloaded) {
    const persisted = await loadPersistedDecryptedMessageFn?.(message, userId);
    if (persisted) {
      const result = buildPersistedMessage(message, persisted);
      if (getConversationDecryptState(message)) {
        recordDecryptDiagnosticFn?.({
          message,
          event: 'recovered',
          recoveredVia: 'persisted',
        });
      }
      return result;
    }
  }

  if (message?.sender_npub) {
    rememberUserNpubFn?.(message.sender_id, message.sender_npub);
  }

  if (!isE2EReady) {
    const result = buildPendingMessage(message, nowFn, 'e2e-not-ready');
    recordDecryptDiagnosticFn?.({
      message,
      event: 'pending',
      bucket: 'e2e-not-ready',
    });
    return result;
  }

  if (message?.room_id && options.deferRoomDecrypt) {
    return buildPendingMessage(message, nowFn);
  }

  try {
    if (message?.room_id) {
      const result = await decryptRoomMessage({
        message,
        userId,
        decryptGroupMessageFn,
        persistDecryptedMessageFn,
      });
      if (getConversationDecryptState(message)) {
        recordDecryptDiagnosticFn?.({
          message,
          event: 'recovered',
          recoveredVia: 'decrypt',
        });
      }
      return result;
    }

    const result = await decryptDMMessage({
      message,
      userId,
      decryptDirectMessageFn,
      persistDecryptedMessageFn,
    });
    if (getConversationDecryptState(message)) {
      recordDecryptDiagnosticFn?.({
        message,
        event: 'recovered',
        recoveredVia: 'decrypt',
      });
    }
    return result;
  } catch (initialError) {
    let lastError = initialError;
    const lastBucket = () => classifyConversationDecryptFailure({ error: lastError });

    if (message?.room_id && options.allowRoomSenderKeyRecovery === false) {
      const result = buildPendingMessage(message, nowFn, lastBucket());
      recordDecryptDiagnosticFn?.({
        message,
        event: 'pending',
        error: lastError,
      });
      return result;
    }

    const canRecoverRoomSenderKey = message?.room_id && (
      !retryState
      || !(retryState.attemptedSenderIds instanceof Set && retryState.attemptedSenderIds.has(message.sender_id))
    );

    if (canRecoverRoomSenderKey) {
      retryState?.attemptedSenderIds?.add(message.sender_id);

      const recovery = await recoverRoomMessageAfterSenderKeyMiss({
        message,
        windowObj,
        decryptRoomMessageFn: async () => decryptRoomMessage({
          message,
          userId,
          decryptGroupMessageFn,
          persistDecryptedMessageFn,
        }),
        flushPendingControlMessagesNowFn,
        syncRoomSenderKeysFn,
        requestRoomSenderKeyFn,
        waitForSenderKeyUpdateFn,
      });

      if (recovery?.result) {
        if (getConversationDecryptState(message)) {
          recordDecryptDiagnosticFn?.({
            message,
            event: 'recovered',
            recoveredVia: 'sender-key-recovery',
          });
        }
        return recovery.result;
      }

      lastError = recovery?.lastError || lastError;
    }

    if (!persistedEntriesWerePreloaded) {
      const persistedFallback = await loadPersistedDecryptedMessageFn?.(message, userId);
      if (persistedFallback) {
        const result = buildPersistedMessage(message, persistedFallback);
        if (getConversationDecryptState(message)) {
          recordDecryptDiagnosticFn?.({
            message,
            event: 'recovered',
            recoveredVia: 'persisted',
          });
        }
        return result;
      }
    }

    const shouldStayPending = shouldKeepConversationDecryptPending({
      message,
      error: lastError,
    });

    if (shouldStayPending) {
      const result = buildPendingMessage(message, nowFn, lastBucket());
      recordDecryptDiagnosticFn?.({
        message,
        event: 'pending',
        error: lastError,
      });
      return result;
    }

    recordDecryptDiagnosticFn?.({
      message,
      event: 'failed',
      error: lastError,
      quiet: options.quiet,
    });
    reportDecryptFailureFn?.({
      message,
      error: lastError,
      quiet: options.quiet,
    });

    return buildFailedMessage(message, lastBucket());
  }
}

export async function decryptConversationMessages({
  messages,
  userId,
  options = {},
  loadPersistedDecryptedMessagesFn,
  ...rest
} = {}) {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const persistedEntriesById = (await loadPersistedDecryptedMessagesFn?.(messages, userId)) || new Map();
  const results = [];
  const roomRetryStates = new Map();

  for (const message of messages) {
    let retryState = null;
    if (message?.room_id) {
      retryState = roomRetryStates.get(message.room_id);
      if (!retryState) {
        retryState = { attemptedSenderIds: new Set() };
        roomRetryStates.set(message.room_id, retryState);
      }
    }

    results.push(await tryDecryptConversationMessage({
      ...rest,
      message,
      userId,
      retryState,
      options: {
        ...options,
        persistedEntriesById,
      },
    }));
  }

  return results;
}
