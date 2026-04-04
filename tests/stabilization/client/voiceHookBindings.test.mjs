import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildVoiceCaptureActionControllerOptions,
  buildVoiceCaptureActionRuntime,
  buildVoiceLiveCaptureRuntimeControllerOptions,
  buildVoiceMediaActionControllerOptions,
  buildVoiceMediaActionRuntime,
  buildVoiceRuntimeBindingsRuntime,
  buildVoiceRuntimeBindingsControllerOptions,
  buildVoiceScreenShareRuntimeControllerOptions,
  buildVoiceScreenShareActionControllerOptions,
  buildVoiceScreenShareActionRuntime,
  buildVoiceSecurityActionRuntime,
  buildVoiceSecurityActionControllerOptions,
  buildVoiceSessionActionRuntime,
  buildVoiceSessionJoinRuntime,
  buildVoiceSessionActionControllerOptions,
  buildVoiceTransportActionRuntime,
  buildVoiceTransportActionControllerOptions,
  buildVoiceUiActionRuntime,
  buildVoiceUiActionControllerOptions,
} from '../../../client/src/features/voice/voiceHookBindings.mjs';

test('voice hook bindings preserve the screen-share runtime controller contract', () => {
  const state = { screenSharing: false };
  const refs = { screenShareProducerRef: { current: null } };
  const runtime = { warnFn: () => {} };
  const constants = { initialProfileIndex: 0 };
  const deps = [() => {}];

  const options = buildVoiceScreenShareRuntimeControllerOptions({
    state,
    refs,
    runtime,
    constants,
    deps,
  });

  assert.equal(options.state, state);
  assert.equal(options.refs, refs);
  assert.equal(options.runtime, runtime);
  assert.equal(options.constants, constants);
  assert.equal(options.deps, deps);
});

test('voice hook bindings preserve the live-capture runtime controller contract', () => {
  const state = { voiceProcessingMode: 'balanced' };
  const refs = { liveCaptureRef: { current: null } };
  const runtime = { clearTimeoutFn: () => {} };
  const constants = { voiceSafeMode: true };
  const deps = [() => {}, () => {}];

  const options = buildVoiceLiveCaptureRuntimeControllerOptions({
    state,
    refs,
    runtime,
    constants,
    deps,
  });

  assert.equal(options.state, state);
  assert.equal(options.refs, refs);
  assert.equal(options.runtime, runtime);
  assert.equal(options.constants, constants);
  assert.equal(options.deps, deps);
});

test('voice hook bindings preserve the media and security controller contracts', () => {
  const refs = { consumersRef: { current: new Map() } };
  const mediaRuntime = { updateVoiceDiagnosticsFn: () => {} };
  const mediaDeps = [() => {}];
  const mediaOptions = buildVoiceMediaActionControllerOptions({
    refs,
    runtime: mediaRuntime,
    deps: mediaDeps,
  });

  const securityState = { voiceE2E: null };
  const securityRuntime = { socket: { id: 'socket-1' } };
  const securityConstants = { voiceSafeMode: true };
  const securityDeps = [() => {}];
  const securityOptions = buildVoiceSecurityActionControllerOptions({
    userId: 'user-1',
    state: securityState,
    refs,
    runtime: securityRuntime,
    constants: securityConstants,
    deps: securityDeps,
  });

  assert.equal(mediaOptions.refs, refs);
  assert.equal(mediaOptions.runtime, mediaRuntime);
  assert.equal(mediaOptions.deps, mediaDeps);
  assert.equal(securityOptions.userId, 'user-1');
  assert.equal(securityOptions.state, securityState);
  assert.equal(securityOptions.refs, refs);
  assert.equal(securityOptions.runtime, securityRuntime);
  assert.equal(securityOptions.constants, securityConstants);
  assert.equal(securityOptions.deps, securityDeps);
});

test('voice hook bindings preserve media and security runtime bags', () => {
  const mediaRuntime = buildVoiceMediaActionRuntime({
    setIncomingScreenSharesFn: () => {},
    updateVoiceDiagnosticsFn: () => {},
  });
  const securityRuntime = buildVoiceSecurityActionRuntime({
    socket: { id: 'socket-security' },
    isInsertableStreamsSupportedFn: () => true,
  });

  assert.equal(typeof mediaRuntime.setIncomingScreenSharesFn, 'function');
  assert.equal(typeof mediaRuntime.updateVoiceDiagnosticsFn, 'function');
  assert.equal(securityRuntime.socket.id, 'socket-security');
  assert.equal(securityRuntime.isInsertableStreamsSupportedFn(), true);
});

test('voice hook bindings preserve capture, transport, and session controller contracts', () => {
  const state = { channelId: 'channel-1' };
  const refs = { channelIdRef: { current: 'channel-1' } };

  const captureOptions = buildVoiceCaptureActionControllerOptions({
    state,
    refs,
    runtime: { socket: { id: 'socket-capture' } },
    constants: { voiceMaxBitrate: 64_000 },
    deps: [() => {}],
  });
  const transportOptions = buildVoiceTransportActionControllerOptions({
    currentUserId: 'user-1',
    refs,
    runtime: { emitAsyncFn: () => {} },
    constants: { voiceSafeMode: true },
    deps: [() => {}, () => {}],
  });
  const sessionOptions = buildVoiceSessionActionControllerOptions({
    socket: { id: 'socket-session' },
    state,
    refs,
    runtime: { emitAsyncFn: () => {} },
    constants: { voiceSessionErrorTimeoutMs: 8000 },
    deps: [() => {}],
  });

  assert.equal(captureOptions.state, state);
  assert.equal(captureOptions.refs, refs);
  assert.equal(captureOptions.runtime.socket.id, 'socket-capture');
  assert.equal(captureOptions.constants.voiceMaxBitrate, 64_000);
  assert.equal(transportOptions.currentUserId, 'user-1');
  assert.equal(transportOptions.refs, refs);
  assert.equal(transportOptions.constants.voiceSafeMode, true);
  assert.equal(sessionOptions.socket.id, 'socket-session');
  assert.equal(sessionOptions.state, state);
  assert.equal(sessionOptions.refs, refs);
  assert.equal(sessionOptions.constants.voiceSessionErrorTimeoutMs, 8000);
  assert.equal(sessionOptions.deps.length, 1);
});

test('voice hook bindings preserve capture, transport, and join runtime bags', () => {
  const captureRuntime = buildVoiceCaptureActionRuntime({
    socket: { id: 'socket-capture' },
    summarizeProducerStatsFn: () => ({ packetsSent: 1 }),
  });
  const transportRuntime = buildVoiceTransportActionRuntime({
    emitAsyncFn: async () => 'ok',
    insertableStreamsSupported: true,
  });
  const joinRuntime = buildVoiceSessionJoinRuntime({
    ensureSecureMediaReadyFn: async () => true,
    scheduleClearJoinErrorFn: () => {},
    logErrorFn: () => {},
  });

  assert.equal(captureRuntime.socket.id, 'socket-capture');
  assert.deepEqual(captureRuntime.summarizeProducerStatsFn(), { packetsSent: 1 });
  assert.equal(transportRuntime.insertableStreamsSupported, true);
  assert.equal(typeof transportRuntime.emitAsyncFn, 'function');
  assert.equal(typeof joinRuntime.ensureSecureMediaReadyFn, 'function');
  assert.equal(typeof joinRuntime.scheduleClearJoinErrorFn, 'function');
  assert.equal(typeof joinRuntime.logErrorFn, 'function');
});

test('voice hook bindings preserve session and UI runtime bags', () => {
  const sessionRuntime = buildVoiceSessionActionRuntime({
    emitAsyncFn: async () => 'joined',
    joinRuntime: { ensureSecureMediaReadyFn: async () => true },
  });
  const uiRuntime = buildVoiceUiActionRuntime({
    socket: { id: 'socket-ui' },
    isUltraLowLatencyModeFn: () => true,
  });

  assert.equal(typeof sessionRuntime.emitAsyncFn, 'function');
  assert.equal(typeof sessionRuntime.joinRuntime.ensureSecureMediaReadyFn, 'function');
  assert.equal(uiRuntime.socket.id, 'socket-ui');
  assert.equal(uiRuntime.isUltraLowLatencyModeFn(), true);
});

test('voice hook bindings preserve UI, screen-share, and runtime-effects controller contracts', () => {
  const state = { muted: false };
  const refs = { screenShareProducerRef: { current: null } };

  const uiOptions = buildVoiceUiActionControllerOptions({
    state,
    refs,
    runtime: { socket: { id: 'socket-ui' } },
    deps: [() => {}],
  });
  const screenShareOptions = buildVoiceScreenShareActionControllerOptions({
    state,
    refs,
    runtime: { ensureSecureMediaReadyFn: () => {} },
    constants: { initialProfileIndex: 0 },
    deps: [() => {}],
  });
  const runtimeBindingsOptions = buildVoiceRuntimeBindingsControllerOptions({
    state,
    refs,
    runtime: { currentUserId: 'user-2' },
  });

  assert.equal(uiOptions.state, state);
  assert.equal(uiOptions.refs, refs);
  assert.equal(uiOptions.runtime.socket.id, 'socket-ui');
  assert.equal(screenShareOptions.state, state);
  assert.equal(screenShareOptions.refs, refs);
  assert.equal(screenShareOptions.constants.initialProfileIndex, 0);
  assert.equal(runtimeBindingsOptions.state, state);
  assert.equal(runtimeBindingsOptions.refs, refs);
  assert.equal(runtimeBindingsOptions.runtime.currentUserId, 'user-2');
});

test('voice hook bindings preserve screen-share action and runtime-effects runtime bags', () => {
  const screenShareRuntime = buildVoiceScreenShareActionRuntime({
    socket: { id: 'socket-screen' },
    getPlatformFn: () => 'darwin',
  });
  const runtimeBindingsRuntime = buildVoiceRuntimeBindingsRuntime({
    currentUserId: 'user-3',
    screenShareProfiles: [{ id: 'balanced' }],
  });

  assert.equal(screenShareRuntime.socket.id, 'socket-screen');
  assert.equal(screenShareRuntime.getPlatformFn(), 'darwin');
  assert.equal(runtimeBindingsRuntime.currentUserId, 'user-3');
  assert.deepEqual(runtimeBindingsRuntime.screenShareProfiles, [{ id: 'balanced' }]);
});
