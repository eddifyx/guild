import { useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { flushPendingControlMessagesNow, requestRoomSenderKey, syncRoomSenderKeys } from '../socket';
import { useAuth } from '../contexts/AuthContext';
import { isE2EInitialized } from '../crypto/sessionManager';
import { hasKnownNpub, rememberUserNpub } from '../crypto/identityDirectory';
import { addPerfPhase } from '../utils/devPerf';
import {
  createMessageSendAction,
  DM_UNAVAILABLE_ERROR,
} from '../features/messaging/messageSendFlow.mjs';
import {
  clearDecryptedMessageCaches,
  deletePersistedMessageEntry,
  getCachedDecryptedMessage,
  loadPersistedDecryptedMessage,
  loadPersistedDecryptedMessages,
  persistDecryptedMessage,
  sanitizeCachedAttachments,
} from '../features/messaging/messageDecryptionCache.mjs';
import {
  DEFERRED_ROOM_SENDER_KEY_SYNC_DELAY_MS,
  runMessageReloadFlow,
} from '../features/messaging/messageReloadFlow.mjs';
import {
  clearMessageDecryptRuntime,
  decryptConversationMessages,
  reportDecryptFailure,
  tryDecryptConversationMessage,
} from '../features/messaging/messageDecryptFlow.mjs';
import {
  fetchConversationMessages as fetchConversationMessagesFlow,
  MESSAGE_ROOM_WARM_LIMIT,
  syncConversationRoomSenderKeys as syncConversationRoomSenderKeysFlow,
  warmRoomMessageCache as warmRoomMessageCacheFlow,
} from '../features/messaging/messageFetchFlow.mjs';
import {
  applyDeletedConversationMessage,
  applyEditedConversationMessage,
  processIncomingConversationMessage,
} from '../features/messaging/messageRealtimeFlow.mjs';
import {
  createDeleteMessageAction,
  createEditMessageAction,
  createLoadMoreMessagesAction,
} from '../features/messaging/messageTransportFlow.mjs';
import {
  appendOrReplaceMessage,
  getMessageTimestampValue,
  mergeMessagesById,
  prependOlderMessages,
  replaceMessagesFromSnapshot,
  sortMessagesChronologically,
} from '../features/messaging/messageMergeFlow.mjs';
import {
  cacheConversationState,
  clearConversationCacheState,
  getCachedConversationState,
  getConversationCacheKey,
  updateCachedConversationState,
} from '../features/messaging/messageConversationCache.mjs';
import {
  clearAllMessageCaches,
  createConversationTimestamp,
  hydrateConversationState,
  messageBelongsToConversation,
  persistReadableConversationMessages,
  resetMessageLaneState,
  revokeAttachmentPreviewUrls,
} from '../features/messaging/messageConversationStateFlow.mjs';
import {
  expirePendingDecryptMessages,
  getPendingDecryptVisibilityDelay,
  retryFailedConversationMessages,
  shouldRetryFailedDMConversationMessages,
} from '../features/messaging/messageRecoveryFlow.mjs';
import {
  bindDMDecryptRetry,
  bindRoomSenderKeyRetry,
  schedulePendingDecryptExpiry,
} from '../features/messaging/messageRecoveryRuntime.mjs';
import {
  subscribeConversationLifecycle,
  subscribeConversationRealtime,
} from '../features/messaging/messageSubscriptionFlow.mjs';
import {
  buildConversationLifecycleOptions,
  buildConversationRealtimeOptions,
} from '../features/messaging/messageControllerBindings.mjs';
import {
  buildUseMessagesFlowContracts,
  buildUseMessagesRuntimeContracts,
} from '../features/messaging/messageControllerContracts.mjs';
import {
  createDebugRoomOpenLogger,
  createDecryptMessages,
  createFetchConversationMessages,
  createSyncConversationRoomSenderKeys,
  createTryDecryptMessage,
  createWarmRoomMessageCache,
} from '../features/messaging/messageHookDependencies.mjs';
import { useMessagesControllerRuntime } from '../features/messaging/useMessagesControllerRuntime.mjs';
import { useMessagesRuntimeEffects } from '../features/messaging/useMessagesRuntimeEffects.mjs';
import {
  encryptDirectMessage,
  decryptDirectMessage,
  encryptGroupMessage,
  decryptGroupMessage,
} from '../crypto/messageEncryption';

const PENDING_DECRYPT_VISIBLE_TIMEOUT_MS = 3000;
const debugRoomOpenLog = createDebugRoomOpenLogger({
  windowObj: typeof window !== 'undefined' ? window : null,
});

const tryDecryptMessage = createTryDecryptMessage({
  tryDecryptConversationMessageFn: tryDecryptConversationMessage,
  isE2EInitializedFn: isE2EInitialized,
  getCachedDecryptedMessageFn: getCachedDecryptedMessage,
  loadPersistedDecryptedMessageFn: loadPersistedDecryptedMessage,
  rememberUserNpubFn: rememberUserNpub,
  decryptGroupMessageFn: decryptGroupMessage,
  decryptDirectMessageFn: decryptDirectMessage,
  persistDecryptedMessageFn: persistDecryptedMessage,
  flushPendingControlMessagesNowFn: flushPendingControlMessagesNow,
  syncRoomSenderKeysFn: syncRoomSenderKeys,
  requestRoomSenderKeyFn: requestRoomSenderKey,
  reportDecryptFailureFn: reportDecryptFailure,
  windowObj: typeof window !== 'undefined' ? window : null,
});

const decryptMessages = createDecryptMessages({
  decryptConversationMessagesFn: decryptConversationMessages,
  isE2EInitializedFn: isE2EInitialized,
  getCachedDecryptedMessageFn: getCachedDecryptedMessage,
  loadPersistedDecryptedMessageFn: loadPersistedDecryptedMessage,
  loadPersistedDecryptedMessagesFn: loadPersistedDecryptedMessages,
  rememberUserNpubFn: rememberUserNpub,
  decryptGroupMessageFn: decryptGroupMessage,
  decryptDirectMessageFn: decryptDirectMessage,
  persistDecryptedMessageFn: persistDecryptedMessage,
  flushPendingControlMessagesNowFn: flushPendingControlMessagesNow,
  syncRoomSenderKeysFn: syncRoomSenderKeys,
  requestRoomSenderKeyFn: requestRoomSenderKey,
  reportDecryptFailureFn: reportDecryptFailure,
  windowObj: typeof window !== 'undefined' ? window : null,
});

const syncConversationRoomSenderKeys = createSyncConversationRoomSenderKeys({
  syncConversationRoomSenderKeysFlowFn: syncConversationRoomSenderKeysFlow,
  syncRoomSenderKeysFn: syncRoomSenderKeys,
  flushPendingControlMessagesNowFn: flushPendingControlMessagesNow,
});

const fetchConversationMessages = createFetchConversationMessages({
  fetchConversationMessagesFlowFn: fetchConversationMessagesFlow,
  apiFn: api,
  decryptMessagesFn: decryptMessages,
  syncConversationRoomSenderKeysFn: syncConversationRoomSenderKeys,
  sortMessagesChronologicallyFn: sortMessagesChronologically,
  warnFn: console.warn,
});

export const warmRoomMessageCache = createWarmRoomMessageCache({
  warmRoomMessageCacheFlowFn: warmRoomMessageCacheFlow,
  roomWarmLimit: MESSAGE_ROOM_WARM_LIMIT,
  isE2EInitializedFn: isE2EInitialized,
  getCachedConversationStateFn: getCachedConversationState,
  fetchConversationMessagesFn: fetchConversationMessages,
  cacheConversationStateFn: cacheConversationState,
  sortMessagesChronologicallyFn: sortMessagesChronologically,
  warnFn: console.warn,
});

export function useMessages(conversation, perfTraceId = null) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const runtimeWindowObject = typeof window !== 'undefined' ? window : globalThis;
  const runtimeElectronWindow = typeof window !== 'undefined' ? window : null;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const prevConvRef = useRef(null);
  const pendingSentMessagesRef = useRef(new Map());
  const messagesRef = useRef([]);
  const retryFailedVisibleRoomMessagesRef = useRef(async () => {});
  const deferredRoomSenderKeySyncTimeoutRef = useRef(null);
  const flowContracts = useMemo(() => buildUseMessagesFlowContracts({
    conversation,
    runMessageReloadFlowFn: runMessageReloadFlow,
    getConversationCacheKeyFn: getConversationCacheKey,
    messageBelongsToConversationFn: messageBelongsToConversation,
    fetchConversationMessagesFn: fetchConversationMessages,
    cacheConversationStateFn: cacheConversationState,
    replaceMessagesFromSnapshotFn: replaceMessagesFromSnapshot,
    mergeMessagesByIdFn: mergeMessagesById,
    debugRoomOpenLogFn: debugRoomOpenLog,
    addPerfPhaseFn: addPerfPhase,
    sortMessagesChronologicallyFn: sortMessagesChronologically,
    syncConversationRoomSenderKeysFn: syncConversationRoomSenderKeys,
    dmUnavailableError: DM_UNAVAILABLE_ERROR,
    retryFailedConversationMessagesFn: retryFailedConversationMessages,
    tryDecryptMessageFn: tryDecryptMessage,
    getMessageTimestampValueFn: getMessageTimestampValue,
    createMessageSendActionFn: createMessageSendAction,
    isE2EInitializedFn: isE2EInitialized,
    hasKnownNpubFn: hasKnownNpub,
    encryptGroupMessageFn: encryptGroupMessage,
    encryptDirectMessageFn: encryptDirectMessage,
    createConversationTimestampFn: createConversationTimestamp,
    appendOrReplaceMessageFn: appendOrReplaceMessage,
    updateCachedConversationStateFn: updateCachedConversationState,
    sanitizeCachedAttachmentsFn: sanitizeCachedAttachments,
    persistDecryptedMessageFn: persistDecryptedMessage,
    revokeAttachmentPreviewUrlsFn: revokeAttachmentPreviewUrls,
    createLoadMoreMessagesActionFn: createLoadMoreMessagesAction,
    prependOlderMessagesFn: prependOlderMessages,
    createEditMessageActionFn: createEditMessageAction,
    createDeleteMessageActionFn: createDeleteMessageAction,
  }), [conversation, perfTraceId]);
  const runtimeContracts = useMemo(() => buildUseMessagesRuntimeContracts({
    clearAllMessageCachesFn: clearAllMessageCaches,
    clearDecryptedMessageCachesFn: clearDecryptedMessageCaches,
    clearConversationCacheStateFn: clearConversationCacheState,
    clearMessageDecryptRuntimeFn: clearMessageDecryptRuntime,
    revokeAttachmentPreviewUrlsFn: revokeAttachmentPreviewUrls,
    resetMessageLaneStateFn: resetMessageLaneState,
    hydrateConversationStateFn: hydrateConversationState,
    getConversationCacheKeyFn: getConversationCacheKey,
    getCachedConversationStateFn: getCachedConversationState,
    bindDMDecryptRetryFn: bindDMDecryptRetry,
    bindRoomSenderKeyRetryFn: bindRoomSenderKeyRetry,
    windowObj: runtimeElectronWindow,
    schedulePendingDecryptExpiryFn: schedulePendingDecryptExpiry,
    visibleTimeoutMs: PENDING_DECRYPT_VISIBLE_TIMEOUT_MS,
    getPendingDecryptVisibilityDelayFn: getPendingDecryptVisibilityDelay,
    expirePendingDecryptMessagesFn: expirePendingDecryptMessages,
    cacheConversationStateFn: cacheConversationState,
    shouldRetryFailedDMConversationMessagesFn: shouldRetryFailedDMConversationMessages,
    subscribeConversationRealtimeFn: subscribeConversationRealtime,
    buildConversationRealtimeOptionsFn: buildConversationRealtimeOptions,
    tryDecryptMessageFn: tryDecryptMessage,
    appendOrReplaceMessageFn: appendOrReplaceMessage,
    updateCachedConversationStateFn: updateCachedConversationState,
    sanitizeCachedAttachmentsFn: sanitizeCachedAttachments,
    persistDecryptedMessageFn: persistDecryptedMessage,
    processIncomingConversationMessageFn: processIncomingConversationMessage,
    persistReadableConversationMessagesFn: persistReadableConversationMessages,
    subscribeConversationLifecycleFn: subscribeConversationLifecycle,
    buildConversationLifecycleOptionsFn: buildConversationLifecycleOptions,
    deletePersistedMessageEntryFn: deletePersistedMessageEntry,
    applyEditedConversationMessageFn: applyEditedConversationMessage,
    applyDeletedConversationMessageFn: applyDeletedConversationMessage,
  }), [runtimeElectronWindow]);
  const {
    sendMessage,
    loadMore,
    editMessage,
    deleteMessage,
  } = useMessagesControllerRuntime({
    conversation,
    user,
    userId: user?.userId,
    socket,
    messages,
    loading,
    hasMore,
    perfTraceId,
    refs: {
      pendingSentMessagesRef,
      messagesRef,
      prevConvRef,
      retryFailedVisibleRoomMessagesRef,
      deferredRoomSenderKeySyncTimeoutRef,
    },
    setters: {
      setLoadingFn: setLoading,
      setMessagesFn: setMessages,
      setHasMoreFn: setHasMore,
      setErrorFn: setError,
    },
    flows: flowContracts,
    runtime: runtimeContracts,
    windowObject: runtimeWindowObject,
    consoleWarnFn: console.warn,
    consoleErrorFn: console.error,
  });

  return { messages, loading, hasMore, error, sendMessage, loadMore, editMessage, deleteMessage };
}
