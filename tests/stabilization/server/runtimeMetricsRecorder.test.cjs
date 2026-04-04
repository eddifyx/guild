const test = require('node:test');
const assert = require('node:assert/strict');

const { createRuntimeMetricsState } = require('../../../server/src/monitoring/runtimeMetricsState');
const { createRuntimeMetricsRecorder } = require('../../../server/src/monitoring/runtimeMetricsRecorder');

test('runtime metrics recorder tracks http outcomes and emits slow/error notes canonically', () => {
  const state = createRuntimeMetricsState();
  const events = [];
  const notes = [];
  const recorder = createRuntimeMetricsRecorder({
    state,
    classifyStatus: () => '2xx',
    normalizeUrl: (url) => `normalized:${url}`,
    pushEvent: (bucket, payload) => {
      bucket.push(payload);
      events.push(payload);
    },
    addNote: (targetState, level, message, details) => {
      notes.push({ level, message, details });
      targetState.notes.push({ level, message, details });
    },
  });

  recorder.beginHttpRequest();
  recorder.endHttpRequest({
    method: 'GET',
    url: '/api/messages/1',
    statusCode: 200,
    durationMs: 1700,
  });
  recorder.endHttpRequest({
    method: 'POST',
    url: '/api/messages/2',
    statusCode: 500,
    durationMs: 400,
  });

  assert.equal(state.http.inflight, 0);
  assert.equal(state.http.total, 2);
  assert.equal(state.http.statusClasses['2xx'], 2);
  assert.equal(state.http.errors.length, 1);
  assert.equal(events[0].url, 'normalized:/api/messages/1');
  assert.deepEqual(notes.map((note) => note.message), [
    'slow http request',
    'server returned 5xx',
  ]);
});

test('runtime metrics recorder tracks socket, chat, and voice event counters through the shared state', () => {
  const state = createRuntimeMetricsState();
  const recorder = createRuntimeMetricsRecorder({
    state,
    classifyStatus: () => '2xx',
    normalizeUrl: (url) => url,
    pushEvent: (bucket, payload) => {
      bucket.push(payload);
    },
    addNote: (targetState, level, message, details) => {
      targetState.notes.push({ level, message, details });
    },
  });

  recorder.recordSocketAuthSuccess();
  recorder.recordSocketAuthFailure('missing_token');
  recorder.recordSocketConnectionOpen({ userId: 'user-1' });
  recorder.recordSocketConnectionClose({ userId: 'user-1' });
  recorder.recordChatMessage('guildchat', { guildId: 'guild-1' });
  recorder.recordChatMessage('dm', { userId: 'user-2' });
  recorder.recordChatError('send_failed', { roomId: 'room-1' });
  recorder.recordChatEvent('guildchat:join', { guildId: 'guild-1' });
  recorder.recordVoiceJoin({ channelId: 'voice-1' });
  recorder.recordVoiceLeave({ channelId: 'voice-1' });
  recorder.recordVoiceProduce({ producerId: 'producer-1' });
  recorder.recordVoiceConsume({ consumerId: 'consumer-1' });
  recorder.recordVoiceError('voice:join', { channelId: 'voice-1' });
  recorder.recordVoiceEvent('voice:transport_connected', { channelId: 'voice-1' });

  assert.equal(state.sockets.authSuccessesTotal, 1);
  assert.equal(state.sockets.authFailuresTotal, 1);
  assert.equal(state.sockets.totalConnections, 1);
  assert.equal(state.sockets.totalDisconnections, 1);
  assert.equal(state.chat.roomMessagesTotal, 1);
  assert.equal(state.chat.dmMessagesTotal, 1);
  assert.equal(state.chat.handlerErrorsTotal, 1);
  assert.equal(state.voice.joinsTotal, 1);
  assert.equal(state.voice.leavesTotal, 1);
  assert.equal(state.voice.producesTotal, 1);
  assert.equal(state.voice.consumesTotal, 1);
  assert.equal(state.voice.errorsTotal, 1);
  assert.equal(state.notes.length, 3);
});
