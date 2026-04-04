import { clearLaneDiagnostics, getLaneDiagnostics } from '../../utils/laneDiagnostics.js';

const MESSAGE_DECRYPT_LANE = 'message-decrypt';
const MAX_DECRYPT_DIAGNOSTICS = 50;
const MAX_ACTIVE_MESSAGES = 40;

function getConversationDescriptor(conversation = null) {
  if (!conversation?.id || !conversation?.type) return null;
  return {
    id: conversation.id,
    type: conversation.type,
  };
}

function isConversationMessage(message, conversation, userId) {
  if (!conversation?.id || !conversation?.type || !message?.encrypted) return false;

  if (conversation.type === 'room') {
    return message?.room_id === conversation.id;
  }

  if (conversation.type === 'dm') {
    return !message?.room_id && (
      (message?.sender_id === conversation.id && message?.dm_partner_id === userId) ||
      (message?.sender_id === userId && message?.dm_partner_id === conversation.id)
    );
  }

  return false;
}

function buildActiveDecryptMessageRecord(message, nowMs) {
  if (!message?.encrypted || (!message?._decryptionPending && !message?._decryptionFailed)) {
    return null;
  }

  const pendingSince = Number(message?._decryptionPendingSince);
  return {
    messageId: message?.id || null,
    route: message?.room_id ? 'room' : 'dm',
    state: message?._decryptionPending ? 'pending' : 'failed',
    bucket: message?._decryptionBucket || null,
    roomId: message?.room_id || null,
    senderUserId: message?.sender_id || null,
    dmPartnerId: message?.dm_partner_id || null,
    pendingMs: Number.isFinite(pendingSince) ? Math.max(0, nowMs - pendingSince) : null,
  };
}

export function readMessageDecryptDiagnostics({
  diagnostics = getLaneDiagnostics(),
  limit = MAX_DECRYPT_DIAGNOSTICS,
} = {}) {
  const boundedLimit = Number.isInteger(limit) && limit > 0 ? limit : MAX_DECRYPT_DIAGNOSTICS;
  return (Array.isArray(diagnostics) ? diagnostics : [])
    .filter((entry) => (
      entry?.lane === MESSAGE_DECRYPT_LANE
      && typeof entry?.event === 'string'
      && entry.event.startsWith('conversation-decrypt-')
    ))
    .slice(-boundedLimit);
}

export function summarizeMessageDecryptDiagnostics({
  diagnostics = getLaneDiagnostics(),
  limit = MAX_DECRYPT_DIAGNOSTICS,
} = {}) {
  const entries = readMessageDecryptDiagnostics({ diagnostics, limit });
  const summary = {
    total: entries.length,
    byEvent: {},
    byBucket: {},
    recoveredBy: {},
  };

  for (const entry of entries) {
    const event = entry?.event || 'unknown';
    const bucket = entry?.details?.bucket || 'unknown';
    const recoveredVia = entry?.details?.recoveredVia || null;

    summary.byEvent[event] = (summary.byEvent[event] || 0) + 1;
    summary.byBucket[bucket] = (summary.byBucket[bucket] || 0) + 1;

    if (recoveredVia) {
      summary.recoveredBy[recoveredVia] = (summary.recoveredBy[recoveredVia] || 0) + 1;
    }
  }

  return summary;
}

export function buildActiveConversationDecryptSnapshot({
  conversation = null,
  userId = null,
  messages = [],
  nowFn = () => Date.now(),
  limit = MAX_ACTIVE_MESSAGES,
} = {}) {
  const descriptor = getConversationDescriptor(conversation);
  const boundedLimit = Number.isInteger(limit) && limit > 0 ? limit : MAX_ACTIVE_MESSAGES;
  const nowMs = typeof nowFn === 'function' ? nowFn() : Date.now();

  const activeMessages = (Array.isArray(messages) ? messages : [])
    .filter((message) => isConversationMessage(message, conversation, userId))
    .map((message) => buildActiveDecryptMessageRecord(message, nowMs))
    .filter(Boolean)
    .slice(-boundedLimit);

  const bucketCounts = {};
  let pendingCount = 0;
  let failedCount = 0;

  for (const message of activeMessages) {
    if (message.state === 'pending') pendingCount += 1;
    if (message.state === 'failed') failedCount += 1;
    const bucket = message.bucket || 'unknown';
    bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1;
  }

  return {
    at: new Date(nowMs).toISOString(),
    conversation: descriptor,
    pendingCount,
    failedCount,
    bucketCounts,
    messages: activeMessages,
  };
}

export function parseMessageDecryptDebugLogLines(lines = []) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => {
      const match = /^\[([^\]]+)\]\s+\[([^\]]+)\]\s+(.*)$/.exec(String(line || ''));
      if (!match || match[2] !== 'message-decrypt') return null;

      try {
        return JSON.parse(match[3]);
      } catch {
        return {
          at: match[1],
          lane: 'message-decrypt',
          event: 'unparsed',
          details: {
            raw: match[3],
          },
        };
      }
    })
    .filter(Boolean);
}

export async function readMessageDecryptElectronLog({
  windowObj = null,
  limit = MAX_DECRYPT_DIAGNOSTICS,
  parseMessageDecryptDebugLogLinesFn = parseMessageDecryptDebugLogLines,
} = {}) {
  if (!windowObj?.electronAPI?.getDebugLogTail) return [];
  const lines = await windowObj.electronAPI.getDebugLogTail('message-decrypt', limit);
  return parseMessageDecryptDebugLogLinesFn(lines);
}

export function installMessageDecryptDebugSurface({
  windowObj = null,
  getActiveConversationDecryptSnapshotFn = () => null,
  getLaneDiagnosticsFn = getLaneDiagnostics,
  clearLaneDiagnosticsFn = clearLaneDiagnostics,
  readMessageDecryptDiagnosticsFn = readMessageDecryptDiagnostics,
  summarizeMessageDecryptDiagnosticsFn = summarizeMessageDecryptDiagnostics,
  readMessageDecryptElectronLogFn = readMessageDecryptElectronLog,
} = {}) {
  if (!windowObj) return () => {};

  const root = (
    windowObj.__guildMessagesDebug
    && typeof windowObj.__guildMessagesDebug === 'object'
  ) ? windowObj.__guildMessagesDebug : {};

  const decryptSurface = {
    readDiagnostics(options = {}) {
      return readMessageDecryptDiagnosticsFn({
        diagnostics: getLaneDiagnosticsFn?.(),
        ...options,
      });
    },
    summarizeDiagnostics(options = {}) {
      return summarizeMessageDecryptDiagnosticsFn({
        diagnostics: getLaneDiagnosticsFn?.(),
        ...options,
      });
    },
    readActiveConversation() {
      return getActiveConversationDecryptSnapshotFn?.() || null;
    },
    async readElectronLog(options = {}) {
      return readMessageDecryptElectronLogFn({
        windowObj,
        ...options,
      });
    },
    clearDiagnostics() {
      clearLaneDiagnosticsFn?.();
      return [];
    },
  };

  root.decrypt = decryptSurface;
  windowObj.__guildMessagesDebug = root;

  return () => {
    if (windowObj.__guildMessagesDebug?.decrypt === decryptSurface) {
      delete windowObj.__guildMessagesDebug.decrypt;
      if (Object.keys(windowObj.__guildMessagesDebug).length === 0) {
        delete windowObj.__guildMessagesDebug;
      }
    }
  };
}
