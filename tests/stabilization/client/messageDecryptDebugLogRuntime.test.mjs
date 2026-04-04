import test from 'node:test';
import assert from 'node:assert/strict';

import { LANE_DIAGNOSTIC_EVENT_NAME, recordLaneDiagnostic } from '../../../client/src/utils/laneDiagnostics.js';
import {
  buildMessageDecryptDebugLogPayload,
  installMessageDecryptDebugLogBridge,
} from '../../../client/src/features/messaging/messageDecryptDebugLogRuntime.mjs';

test('message decrypt debug log runtime shapes only sanitized decrypt diagnostics for the Electron debug log', () => {
  const payload = buildMessageDecryptDebugLogPayload({
    at: '2026-03-28T00:00:00.000Z',
    lane: 'message-decrypt',
    event: 'conversation-decrypt-failed',
    details: {
      messageId: 'msg-1',
      route: 'dm',
      roomId: null,
      senderUserId: 'peer-1',
      dmPartnerId: 'self-1',
      bucket: 'missing-dm-copy',
      recoverable: false,
      previousState: 'pending',
      recoveredVia: null,
      quiet: true,
      reason: 'No DM copy available for device 5',
      content: 'ciphertext',
    },
  });

  assert.deepEqual(payload, {
    at: '2026-03-28T00:00:00.000Z',
    lane: 'message-decrypt',
    event: 'conversation-decrypt-failed',
    details: {
      messageId: 'msg-1',
      route: 'dm',
      roomId: null,
      senderUserId: 'peer-1',
      dmPartnerId: 'self-1',
      bucket: 'missing-dm-copy',
      recoverable: false,
      previousState: 'pending',
      recoveredVia: null,
      quiet: true,
      reason: 'No DM copy available for device 5',
    },
  });
  assert.equal(JSON.stringify(payload).includes('ciphertext'), false);
});

test('message decrypt debug log runtime forwards only message-decrypt lane events to electron debug logging', () => {
  const listeners = new Map();
  const debugCalls = [];
  const windowObj = {
    electronAPI: {
      debugLog: (...args) => {
        debugCalls.push(args);
        return true;
      },
    },
    addEventListener(eventName, handler) {
      listeners.set(eventName, handler);
    },
    removeEventListener(eventName, handler) {
      if (listeners.get(eventName) === handler) {
        listeners.delete(eventName);
      }
    },
  };

  const cleanup = installMessageDecryptDebugLogBridge({ windowObj });
  listeners.get(LANE_DIAGNOSTIC_EVENT_NAME)?.({
    detail: {
      lane: 'voice',
      event: 'join_ready',
      details: {},
    },
  });
  listeners.get(LANE_DIAGNOSTIC_EVENT_NAME)?.({
    detail: {
      at: '2026-03-28T00:00:00.000Z',
      lane: 'message-decrypt',
      event: 'conversation-decrypt-recovered',
      details: {
        messageId: 'msg-9',
        bucket: 'missing-session',
        recoveredVia: 'signal-session-ready',
      },
    },
  });

  assert.deepEqual(debugCalls, [[
    'message-decrypt',
    JSON.stringify({
      at: '2026-03-28T00:00:00.000Z',
      lane: 'message-decrypt',
      event: 'conversation-decrypt-recovered',
      details: {
        messageId: 'msg-9',
        route: null,
        roomId: null,
        senderUserId: null,
        dmPartnerId: null,
        bucket: 'missing-session',
        recoverable: undefined,
        previousState: null,
        recoveredVia: 'signal-session-ready',
        quiet: undefined,
        reason: null,
      },
    }),
  ]]);

  cleanup();
  assert.equal(listeners.has(LANE_DIAGNOSTIC_EVENT_NAME), false);
});
