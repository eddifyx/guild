import { createSocketEncryptedControlMessageRuntime } from './socketEncryptedControlMessageRuntime.mjs';
import { createSocketPendingControlQueueRuntime } from './socketPendingControlQueueRuntime.mjs';

export function createSocketEncryptedControlRuntime({
  apiRequestFn = async () => null,
  importSessionManagerFn,
  importIdentityDirectoryFn,
  importMessageEncryptionFn,
  importSenderKeysFn,
  importVoiceEncryptionFn,
  nowFn = () => Date.now(),
  setIntervalFn,
  clearIntervalFn,
  createCustomEventFn,
  dispatchEventFn,
  warnFn,
} = {}) {
  const controlMessageRuntime = createSocketEncryptedControlMessageRuntime({
    apiRequestFn,
    importSessionManagerFn,
    importIdentityDirectoryFn,
    importMessageEncryptionFn,
    importSenderKeysFn,
    importVoiceEncryptionFn,
    createCustomEventFn,
    dispatchEventFn,
    warnFn,
  });

  const controlQueueRuntime = createSocketPendingControlQueueRuntime({
    processEncryptedControlMessageFn: controlMessageRuntime.processEncryptedControlMessage,
    acknowledgeProcessedControlMessageFn: controlMessageRuntime.acknowledgeProcessedControlMessage,
    nowFn,
    setIntervalFn,
    clearIntervalFn,
    warnFn,
  });

  return {
    acknowledgeProcessedControlMessage: controlMessageRuntime.acknowledgeProcessedControlMessage,
    acknowledgeSenderKeyReceipts: controlMessageRuntime.acknowledgeSenderKeyReceipts,
    clearPendingControlMessages: controlQueueRuntime.reset,
    flushPendingControlMessages: controlQueueRuntime.flushPendingControlMessages,
    flushPendingControlMessagesNow: controlQueueRuntime.flushPendingControlMessagesNow,
    getStateSnapshot: controlQueueRuntime.getStateSnapshot,
    handleSocketConnect: controlQueueRuntime.handleSocketConnect,
    processEncryptedControlMessage: controlMessageRuntime.processEncryptedControlMessage,
    queuePendingControlMessage: controlQueueRuntime.queuePendingControlMessage,
    reset: controlQueueRuntime.reset,
    shouldAcknowledgeSenderKeyError: controlMessageRuntime.shouldAcknowledgeSenderKeyError,
  };
}
