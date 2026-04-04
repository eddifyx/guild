import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUseVoiceHookCaptureControllerOptions,
  buildUseVoiceHookMediaTransportControllerOptions,
  buildUseVoiceHookRuntimeBindingsControllerOptions,
  buildUseVoiceHookScreenShareControllerOptions,
  buildUseVoiceHookSecurityControllerOptions,
  buildUseVoiceHookSessionControllerOptions,
  buildUseVoiceHookUiControllerOptions,
} from '../../../client/src/features/voice/voiceHookControllerBindings.mjs';

test('voice hook controller bindings preserve screen-share, security, and capture contracts', () => {
  const state = { channelId: 'voice-1' };
  const refs = { channelIdRef: { current: 'voice-1' } };

  const screenShareRuntime = { ensureSecureMediaReadyFn: async () => true };
  const securityRuntime = { clearVoiceKeyFn: () => {} };
  const captureRuntime = { applyNoiseSuppressionRoutingFn: () => {} };

  const screenShareOptions = buildUseVoiceHookScreenShareControllerOptions({
    socket: { id: 'socket-screen' },
    state,
    refs,
    runtime: screenShareRuntime,
  });
  const securityOptions = buildUseVoiceHookSecurityControllerOptions({
    socket: { id: 'socket-security' },
    userId: 'user-1',
    state,
    refs,
    runtime: securityRuntime,
  });
  const captureOptions = buildUseVoiceHookCaptureControllerOptions({
    socket: { id: 'socket-capture' },
    state,
    refs,
    runtime: captureRuntime,
  });

  assert.equal(screenShareOptions.socket.id, 'socket-screen');
  assert.equal(screenShareOptions.state, state);
  assert.equal(screenShareOptions.refs, refs);
  assert.equal(screenShareOptions.runtime, screenShareRuntime);
  assert.equal(securityOptions.socket.id, 'socket-security');
  assert.equal(securityOptions.userId, 'user-1');
  assert.equal(securityOptions.state, state);
  assert.equal(securityOptions.refs, refs);
  assert.equal(securityOptions.runtime, securityRuntime);
  assert.equal(captureOptions.socket.id, 'socket-capture');
  assert.equal(captureOptions.state, state);
  assert.equal(captureOptions.refs, refs);
  assert.equal(captureOptions.runtime, captureRuntime);
});

test('voice hook controller bindings preserve media, session, and UI contracts', () => {
  const state = { muted: false };
  const refs = { producerRef: { current: null } };

  const mediaRuntime = { emitAsyncFn: async () => 'ok' };
  const sessionRuntime = { clearVoiceHealthProbeFn: () => {} };
  const uiRuntime = { scheduleVoiceHealthProbeFn: () => {} };
  const sessionConstants = { voiceSessionErrorTimeoutMs: 5000 };
  const sessionDeps = ['dep-1', 'dep-2'];

  const mediaOptions = buildUseVoiceHookMediaTransportControllerOptions({
    socket: { id: 'socket-media' },
    currentUserId: 'user-2',
    state,
    refs,
    runtime: mediaRuntime,
  });
  const sessionOptions = buildUseVoiceHookSessionControllerOptions({
    socket: { id: 'socket-session' },
    state,
    refs,
    runtime: sessionRuntime,
    constants: sessionConstants,
    deps: sessionDeps,
  });
  const uiOptions = buildUseVoiceHookUiControllerOptions({
    socket: { id: 'socket-ui' },
    state,
    refs,
    runtime: uiRuntime,
  });

  assert.equal(mediaOptions.socket.id, 'socket-media');
  assert.equal(mediaOptions.currentUserId, 'user-2');
  assert.equal(mediaOptions.state, state);
  assert.equal(mediaOptions.refs, refs);
  assert.equal(mediaOptions.runtime, mediaRuntime);
  assert.equal(sessionOptions.socket.id, 'socket-session');
  assert.equal(sessionOptions.state, state);
  assert.equal(sessionOptions.refs, refs);
  assert.equal(sessionOptions.runtime, sessionRuntime);
  assert.equal(sessionOptions.constants, sessionConstants);
  assert.equal(sessionOptions.deps, sessionDeps);
  assert.equal(uiOptions.socket.id, 'socket-ui');
  assert.equal(uiOptions.state, state);
  assert.equal(uiOptions.refs, refs);
  assert.equal(uiOptions.runtime, uiRuntime);
});

test('voice hook controller bindings preserve runtime-effects contract', () => {
  const state = { screenSharing: false };
  const refs = { consumerRef: { current: null } };
  const runtime = { currentUserId: 'user-3' };

  const options = buildUseVoiceHookRuntimeBindingsControllerOptions({
    state,
    refs,
    runtime,
  });

  assert.equal(options.state, state);
  assert.equal(options.refs, refs);
  assert.equal(options.runtime, runtime);
});
