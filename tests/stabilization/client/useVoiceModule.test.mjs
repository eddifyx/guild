import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice controller wrapper modules import cleanly and expose hook factories', async () => {
  const mediaModule = await import('../../../client/src/features/voice/useVoiceMediaController.mjs');
  const mediaActionModule = await import('../../../client/src/features/voice/useVoiceMediaActionController.mjs');
  const uiModule = await import('../../../client/src/features/voice/useVoiceUiController.mjs');
  const uiActionModule = await import('../../../client/src/features/voice/useVoiceUiActionController.mjs');
  const captureActionModule = await import('../../../client/src/features/voice/useVoiceCaptureActionController.mjs');
  const securityActionModule = await import('../../../client/src/features/voice/useVoiceSecurityActionController.mjs');
  const sessionActionModule = await import('../../../client/src/features/voice/useVoiceSessionActionController.mjs');
  const screenShareModule = await import('../../../client/src/features/voice/useVoiceScreenShareRuntimeController.mjs');
  const screenShareBindingsModule = await import('../../../client/src/features/voice/useVoiceScreenShareBindingsController.mjs');
  const screenShareActionModule = await import('../../../client/src/features/voice/useVoiceScreenShareActionController.mjs');
  const screenShareBridgeModule = await import('../../../client/src/features/voice/useVoiceHookScreenShareBridgeController.mjs');
  const hookSessionActionsModule = await import('../../../client/src/features/voice/useVoiceHookSessionActionsController.mjs');
  const hookUiActionsModule = await import('../../../client/src/features/voice/useVoiceHookUiActionsController.mjs');
  const hookControllerCallbacksModule = await import('../../../client/src/features/voice/useVoiceHookControllerCallbacks.mjs');
  const hookRuntimeEffectsModule = await import('../../../client/src/features/voice/useVoiceHookRuntimeEffectsController.mjs');
  const liveCaptureModule = await import('../../../client/src/features/voice/useVoiceLiveCaptureBindingsController.mjs');
  const liveCaptureRuntimeModule = await import('../../../client/src/features/voice/useVoiceLiveCaptureRuntimeController.mjs');
  const transportActionModule = await import('../../../client/src/features/voice/useVoiceTransportActionController.mjs');
  const runtimeBindingsModule = await import('../../../client/src/features/voice/useVoiceRuntimeBindingsController.mjs');

  assert.equal(typeof mediaModule.useVoiceMediaController, 'function');
  assert.equal(typeof mediaActionModule.useVoiceMediaActionController, 'function');
  assert.equal(typeof uiModule.useVoiceUiController, 'function');
  assert.equal(typeof uiActionModule.useVoiceUiActionController, 'function');
  assert.equal(typeof captureActionModule.useVoiceCaptureActionController, 'function');
  assert.equal(typeof securityActionModule.useVoiceSecurityActionController, 'function');
  assert.equal(typeof sessionActionModule.useVoiceSessionActionController, 'function');
  assert.equal(typeof screenShareModule.useVoiceScreenShareRuntimeController, 'function');
  assert.equal(typeof screenShareBindingsModule.useVoiceScreenShareBindingsController, 'function');
  assert.equal(typeof screenShareActionModule.useVoiceScreenShareActionController, 'function');
  assert.equal(typeof screenShareBridgeModule.useVoiceHookScreenShareBridgeController, 'function');
  assert.equal(typeof hookSessionActionsModule.useVoiceHookSessionActionsController, 'function');
  assert.equal(typeof hookUiActionsModule.useVoiceHookUiActionsController, 'function');
  assert.equal(typeof hookControllerCallbacksModule.useVoiceHookControllerCallbacks, 'function');
  assert.equal(typeof hookRuntimeEffectsModule.useVoiceHookRuntimeEffectsController, 'function');
  assert.equal(typeof liveCaptureModule.useVoiceLiveCaptureBindingsController, 'function');
  assert.equal(typeof liveCaptureRuntimeModule.useVoiceLiveCaptureRuntimeController, 'function');
  assert.equal(typeof transportActionModule.useVoiceTransportActionController, 'function');
  assert.equal(typeof runtimeBindingsModule.useVoiceRuntimeBindingsController, 'function');
});

test('useVoiceHookRuntime delegates controller assembly to the hook runtime shell', async () => {
  const hookRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookRuntime.mjs', import.meta.url),
    'utf8'
  );
  const controllerRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookControllerRuntime.mjs', import.meta.url),
    'utf8'
  );
  const hookControllerOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookControllerOptions.mjs', import.meta.url),
    'utf8'
  );
  const hookControllerRuntimeInputsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookControllerRuntimeInputs.mjs', import.meta.url),
    'utf8'
  );
  const hookCoreRuntimeControllerOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookCoreRuntimeControllerOptions.mjs', import.meta.url),
    'utf8'
  );
  const hookActionRuntimeControllerOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeControllerOptions.mjs', import.meta.url),
    'utf8'
  );
  const hookScreenShareControllerRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookScreenShareControllerRuntime.mjs', import.meta.url),
    'utf8'
  );
  const hookCaptureControllerRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookCaptureControllerRuntime.mjs', import.meta.url),
    'utf8'
  );
  const hookMediaTransportControllerRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookMediaTransportControllerRuntime.mjs', import.meta.url),
    'utf8'
  );
  const hookSecurityControllerRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookSecurityControllerRuntime.mjs', import.meta.url),
    'utf8'
  );
  const hookSessionControllerRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookSessionControllerRuntime.mjs', import.meta.url),
    'utf8'
  );
  const hookUiControllerRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookUiControllerRuntime.mjs', import.meta.url),
    'utf8'
  );
  const hookRuntimeBindingsControllerRuntimeSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookRuntimeBindingsControllerRuntime.mjs', import.meta.url),
    'utf8'
  );
  const hookScreenShareRuntimeBridgeSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookScreenShareRuntimeBridge.mjs', import.meta.url),
    'utf8'
  );
  const hookScreenShareBridgeControllerSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookScreenShareBridgeController.mjs', import.meta.url),
    'utf8'
  );
  const hookScreenShareControllerSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookScreenShareController.mjs', import.meta.url),
    'utf8'
  );
  const hookActionRuntimeControllerSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookActionRuntimeController.mjs', import.meta.url),
    'utf8'
  );
  const hookActionRuntimeControllerInputsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeControllerInputs.mjs', import.meta.url),
    'utf8'
  );
  const hookActionSessionRuntimeInputSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionRuntimeInput.mjs', import.meta.url),
    'utf8'
  );
  const hookActionUiRuntimeInputSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiRuntimeInput.mjs', import.meta.url),
    'utf8'
  );
  const hookActionRuntimeInputSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeInput.mjs', import.meta.url),
    'utf8'
  );
  const hookActionSessionRuntimeControllerSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookActionSessionRuntimeController.mjs', import.meta.url),
    'utf8'
  );
  const hookActionSessionRuntimeControllerInputsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionRuntimeControllerInputs.mjs', import.meta.url),
    'utf8'
  );
  const hookActionSessionActionsInputSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionActionsInput.mjs', import.meta.url),
    'utf8'
  );
  const hookActionSessionRuntimeEffectsInputSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionRuntimeEffectsInput.mjs', import.meta.url),
    'utf8'
  );
  const hookActionSessionLeaveRefSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionLeaveRef.mjs', import.meta.url),
    'utf8'
  );
  const hookActionSessionRuntimeValueSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionRuntimeValue.mjs', import.meta.url),
    'utf8'
  );
  const hookControllerCallbacksSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookControllerCallbacks.mjs', import.meta.url),
    'utf8'
  );
  const hookActionRuntimeBindingsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );
  const hookActionSessionBindingsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionBindings.mjs', import.meta.url),
    'utf8'
  );
  const hookActionSessionControllerOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionControllerOptions.mjs', import.meta.url),
    'utf8'
  );
  const hookActionSessionStateOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionStateOptions.mjs', import.meta.url),
    'utf8'
  );
  const hookActionSessionCoreRuntimeOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionCoreRuntimeOptions.mjs', import.meta.url),
    'utf8'
  );
  const hookActionSessionEnvironmentSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionEnvironment.mjs', import.meta.url),
    'utf8'
  );
  const hookActionUiBindingsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiBindings.mjs', import.meta.url),
    'utf8'
  );
  const hookActionUiControllerOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiControllerOptions.mjs', import.meta.url),
    'utf8'
  );
  const hookActionUiCoreRuntimeOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiCoreRuntimeOptions.mjs', import.meta.url),
    'utf8'
  );
  const hookActionUiEnvironmentSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiEnvironment.mjs', import.meta.url),
    'utf8'
  );
  const hookActionRuntimeEffectsBindingsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsBindings.mjs', import.meta.url),
    'utf8'
  );
  const hookActionRuntimeEffectsControllerOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsControllerOptions.mjs', import.meta.url),
    'utf8'
  );
  const hookActionRuntimeEffectsStateOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsStateOptions.mjs', import.meta.url),
    'utf8'
  );
  const hookActionRuntimeEffectsCoreRuntimeOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsCoreRuntimeOptions.mjs', import.meta.url),
    'utf8'
  );
  const hookActionRuntimeEffectsEnvironmentSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsEnvironment.mjs', import.meta.url),
    'utf8'
  );
  const hookActionRuntimeBuildersSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeBuilders.mjs', import.meta.url),
    'utf8'
  );
  const hookActionSessionOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionSessionOptions.mjs', import.meta.url),
    'utf8'
  );
  const hookActionUiOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionUiOptions.mjs', import.meta.url),
    'utf8'
  );
  const hookActionRuntimeEffectsOptionsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionRuntimeEffectsOptions.mjs', import.meta.url),
    'utf8'
  );
  const hookCoreRuntimeControllerSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookCoreRuntimeController.mjs', import.meta.url),
    'utf8'
  );
  const hookCoreRuntimeControllerInputsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookCoreRuntimeControllerInputs.mjs', import.meta.url),
    'utf8'
  );
  const hookScreenShareRuntimeInputSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookScreenShareRuntimeInput.mjs', import.meta.url),
    'utf8'
  );
  const hookSecurityRuntimeInputSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookSecurityRuntimeInput.mjs', import.meta.url),
    'utf8'
  );
  const hookCaptureRuntimeInputSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookCaptureRuntimeInput.mjs', import.meta.url),
    'utf8'
  );
  const hookMediaTransportRuntimeInputSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookMediaTransportRuntimeInput.mjs', import.meta.url),
    'utf8'
  );
  const hookCoreRuntimeDepsSyncSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookCoreRuntimeDepsSync.mjs', import.meta.url),
    'utf8'
  );
  const hookCoreRuntimeValueSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookCoreRuntimeValue.mjs', import.meta.url),
    'utf8'
  );
  const hookCoreRuntimeInputSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookCoreRuntimeInput.mjs', import.meta.url),
    'utf8'
  );
  const hookSecurityControllerSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookSecurityController.mjs', import.meta.url),
    'utf8'
  );
  const hookCaptureControllerSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookCaptureController.mjs', import.meta.url),
    'utf8'
  );
  const hookMediaTransportControllerSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookMediaTransportController.mjs', import.meta.url),
    'utf8'
  );
  const hookSessionActionsControllerSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookSessionActionsController.mjs', import.meta.url),
    'utf8'
  );
  const hookUiActionsControllerSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookUiActionsController.mjs', import.meta.url),
    'utf8'
  );
  const hookRuntimeEffectsControllerSource = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookRuntimeEffectsController.mjs', import.meta.url),
    'utf8'
  );
  const hookControllerBindingsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookControllerBindings.mjs', import.meta.url),
    'utf8'
  );
  const hookActionCoreRuntimeShapeSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookActionCoreRuntimeShape.mjs', import.meta.url),
    'utf8'
  );
  const hookControllerRuntimeValueSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookControllerRuntimeValue.mjs', import.meta.url),
    'utf8'
  );
  const hookControllerRuntimeDepsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookControllerRuntimeDeps.mjs', import.meta.url),
    'utf8'
  );
  const hookSecurityRuntimeDepsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookSecurityRuntimeDeps.mjs', import.meta.url),
    'utf8'
  );
  const hookCaptureRuntimeDepsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookCaptureRuntimeDeps.mjs', import.meta.url),
    'utf8'
  );
  const hookMediaTransportRuntimeDepsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookMediaTransportRuntimeDeps.mjs', import.meta.url),
    'utf8'
  );
  const hookSessionRuntimeDepsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookSessionRuntimeDeps.mjs', import.meta.url),
    'utf8'
  );
  const hookUiRuntimeDepsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookUiRuntimeDeps.mjs', import.meta.url),
    'utf8'
  );
  const hookRuntimeBindingsRuntimeDepsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookRuntimeBindingsRuntimeDeps.mjs', import.meta.url),
    'utf8'
  );
  const hookControllerRuntimeBuildersSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookControllerRuntimeBuilders.mjs', import.meta.url),
    'utf8'
  );
  const hookControllerRuntimeBindingsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookControllerRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );
  const hookSessionRuntimeBuildersSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookSessionRuntimeBuilders.mjs', import.meta.url),
    'utf8'
  );
  const hookUiRuntimeBuildersSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookUiRuntimeBuilders.mjs', import.meta.url),
    'utf8'
  );
  const hookRuntimeEffectsBuildersSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookRuntimeEffectsBuilders.mjs', import.meta.url),
    'utf8'
  );
  const hookScreenShareRuntimeBindingsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookScreenShareRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );
  const hookSecurityRuntimeBindingsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookSecurityRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );
  const hookCaptureRuntimeBindingsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookCaptureRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );
  const hookMediaTransportRuntimeBindingsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookMediaTransportRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );
  const hookSessionRuntimeBindingsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookSessionRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );
  const hookUiRuntimeBindingsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookUiRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );
  const hookRuntimeBindingsRuntimeBindingsSource = await readFile(
    new URL('../../../client/src/features/voice/voiceHookRuntimeBindingsRuntimeBindings.mjs', import.meta.url),
    'utf8'
  );

  assert.match(hookRuntimeSource, /import\s+\{\s*useVoiceHookControllerRuntime\s*\}\s+from/);
  assert.match(hookRuntimeSource, /useVoiceHookControllerRuntime\(\{/);
  assert.match(controllerRuntimeSource, /export function useVoiceHookControllerRuntime/);
  assert.match(controllerRuntimeSource, /import\s+\{\s*useVoiceHookActionRuntimeController\s*\}\s+from/);
  assert.match(controllerRuntimeSource, /import\s+\{\s*useVoiceHookControllerCallbacks\s*\}\s+from/);
  assert.match(controllerRuntimeSource, /import\s+\{\s*setVoiceChannelId\s+as\s+setVoiceChannelIdRuntime\s*\}\s+from/);
  assert.match(controllerRuntimeSource, /import\s+\{\s*setVoiceChannelParticipants\s+as\s+setVoiceChannelParticipantsRuntime\s*\}\s+from/);
  assert.match(controllerRuntimeSource, /import\s+\{[\s\S]*buildUseVoiceHookActionRuntimeInput[\s\S]*\}\s+from/);
  assert.match(controllerRuntimeSource, /const actionController = useVoiceHookActionRuntimeController\(buildUseVoiceHookActionRuntimeInput\(\{/);
  assert.match(controllerRuntimeSource, /import\s+\{\s*useVoiceHookCoreRuntimeController\s*\}\s+from/);
  assert.match(controllerRuntimeSource, /const coreController = useVoiceHookCoreRuntimeController\(buildUseVoiceHookCoreRuntimeInput\(\{/);
  assert.match(controllerRuntimeSource, /useVoiceHookControllerCallbacks\(\{/);
  assert.match(controllerRuntimeSource, /const setVoiceChannelIdFn = typeof setVoiceChannelIdState === 'function'/);
  assert.match(controllerRuntimeSource, /const setVoiceChannelParticipantsFn = typeof setVoiceChannelParticipantsState === 'function'/);
  assert.match(controllerRuntimeSource, /coreRuntime,\s*\n\s*\}\)\);/);
  assert.match(controllerRuntimeSource, /return buildUseVoiceHookControllerRuntimeValue\(\{[\s\S]*\.\.\.actionController,[\s\S]*\.\.\.coreRuntime,[\s\S]*\}\)/);
  assert.match(hookControllerCallbacksSource, /export function useVoiceHookControllerCallbacks/);
  assert.match(hookControllerRuntimeInputsSource, /voiceHookCoreRuntimeInput/);
  assert.match(hookControllerRuntimeInputsSource, /voiceHookActionRuntimeInput/);
  assert.match(hookCoreRuntimeInputSource, /export function buildUseVoiceHookCoreRuntimeInput/);
  assert.match(hookActionRuntimeInputSource, /export function buildUseVoiceHookActionRuntimeInput/);
  assert.match(hookActionCoreRuntimeShapeSource, /export function buildUseVoiceHookActionCoreRuntime/);
  assert.match(hookControllerRuntimeValueSource, /export function buildUseVoiceHookControllerRuntimeValue/);
  assert.match(hookControllerOptionsSource, /voiceHookCoreRuntimeControllerOptions/);
  assert.match(hookControllerOptionsSource, /voiceHookActionRuntimeControllerOptions/);
  assert.match(hookCoreRuntimeControllerOptionsSource, /export function buildUseVoiceHookCoreRuntimeControllerOptions/);
  assert.match(hookActionRuntimeControllerOptionsSource, /export function buildUseVoiceHookActionRuntimeControllerOptions/);
  assert.match(hookActionRuntimeControllerSource, /export function useVoiceHookActionRuntimeController/);
  assert.match(hookActionRuntimeControllerSource, /import\s+\{\s*useVoiceHookActionSessionRuntimeController\s*\}\s+from/);
  assert.match(hookActionRuntimeControllerSource, /voiceHookActionRuntimeControllerInputs/);
  assert.match(hookActionRuntimeControllerSource, /buildUseVoiceHookActionSessionRuntimeInput/);
  assert.match(hookActionRuntimeControllerSource, /buildUseVoiceHookActionUiRuntimeInput/);
  assert.match(hookActionRuntimeControllerSource, /useVoiceHookActionSessionRuntimeController\(buildUseVoiceHookActionSessionRuntimeInput\(\{/);
  assert.match(hookActionRuntimeControllerSource, /useVoiceHookUiActionsController\(buildUseVoiceHookActionUiRuntimeInput\(\{/);
  assert.match(hookActionRuntimeControllerInputsSource, /voiceHookActionSessionRuntimeInput/);
  assert.match(hookActionRuntimeControllerInputsSource, /voiceHookActionUiRuntimeInput/);
  assert.match(hookActionSessionRuntimeInputSource, /export function buildUseVoiceHookActionSessionRuntimeInput/);
  assert.match(hookActionUiRuntimeInputSource, /export function buildUseVoiceHookActionUiRuntimeInput/);
  assert.match(hookActionSessionRuntimeControllerSource, /export function useVoiceHookActionSessionRuntimeController/);
  assert.match(hookActionSessionRuntimeControllerSource, /voiceHookActionSessionRuntimeControllerInputs/);
  assert.match(hookActionSessionRuntimeControllerSource, /buildUseVoiceHookActionSessionActionsInput/);
  assert.match(hookActionSessionRuntimeControllerSource, /buildUseVoiceHookActionSessionRuntimeEffectsInput/);
  assert.match(hookActionSessionRuntimeControllerSource, /syncUseVoiceHookActionSessionLeaveRef/);
  assert.match(hookActionSessionRuntimeControllerSource, /buildUseVoiceHookActionSessionRuntimeValue/);
  assert.match(hookActionSessionRuntimeControllerSource, /useVoiceHookSessionActionsController\(buildUseVoiceHookActionSessionActionsInput\(\{/);
  assert.match(hookActionSessionRuntimeControllerSource, /useVoiceHookRuntimeEffectsController\(buildUseVoiceHookActionSessionRuntimeEffectsInput\(\{/);
  assert.match(hookActionSessionRuntimeControllerInputsSource, /voiceHookActionSessionActionsInput/);
  assert.match(hookActionSessionRuntimeControllerInputsSource, /voiceHookActionSessionRuntimeEffectsInput/);
  assert.match(hookActionSessionRuntimeControllerInputsSource, /voiceHookActionSessionLeaveRef/);
  assert.match(hookActionSessionRuntimeControllerInputsSource, /voiceHookActionSessionRuntimeValue/);
  assert.match(hookActionSessionActionsInputSource, /export function buildUseVoiceHookActionSessionActionsInput/);
  assert.match(hookActionSessionRuntimeEffectsInputSource, /export function buildUseVoiceHookActionSessionRuntimeEffectsInput/);
  assert.match(hookActionSessionLeaveRefSource, /export function syncUseVoiceHookActionSessionLeaveRef/);
  assert.match(hookActionSessionRuntimeValueSource, /export function buildUseVoiceHookActionSessionRuntimeValue/);
  assert.match(hookActionRuntimeBindingsSource, /voiceHookActionSessionBindings/);
  assert.match(hookActionRuntimeBindingsSource, /voiceHookActionUiBindings/);
  assert.match(hookActionRuntimeBindingsSource, /voiceHookActionRuntimeEffectsBindings/);
  assert.match(hookActionSessionBindingsSource, /voiceHookActionSessionControllerOptions/);
  assert.match(hookActionUiBindingsSource, /voiceHookActionUiControllerOptions/);
  assert.match(hookActionRuntimeEffectsBindingsSource, /voiceHookActionRuntimeEffectsControllerOptions/);
  assert.match(hookActionSessionControllerOptionsSource, /export function buildUseVoiceHookActionSessionControllerOptions/);
  assert.match(hookActionSessionControllerOptionsSource, /buildUseVoiceHookActionSessionStateOptions/);
  assert.match(hookActionSessionControllerOptionsSource, /buildUseVoiceHookActionSessionCoreRuntimeOptions/);
  assert.match(hookActionSessionControllerOptionsSource, /buildUseVoiceHookActionSessionEnvironment/);
  assert.match(hookActionSessionStateOptionsSource, /export function buildUseVoiceHookActionSessionStateOptions/);
  assert.match(hookActionSessionCoreRuntimeOptionsSource, /export function buildUseVoiceHookActionSessionCoreRuntimeOptions/);
  assert.match(hookActionSessionEnvironmentSource, /export function buildUseVoiceHookActionSessionEnvironment/);
  assert.match(hookActionUiControllerOptionsSource, /export function buildUseVoiceHookActionUiControllerOptions/);
  assert.match(hookActionUiControllerOptionsSource, /buildUseVoiceHookActionUiCoreRuntimeOptions/);
  assert.match(hookActionUiControllerOptionsSource, /buildUseVoiceHookActionUiEnvironment/);
  assert.match(hookActionUiCoreRuntimeOptionsSource, /export function buildUseVoiceHookActionUiCoreRuntimeOptions/);
  assert.match(hookActionUiEnvironmentSource, /export function buildUseVoiceHookActionUiEnvironment/);
  assert.match(hookActionRuntimeEffectsControllerOptionsSource, /export function buildUseVoiceHookActionRuntimeEffectsControllerOptions/);
  assert.match(hookActionRuntimeEffectsControllerOptionsSource, /export function buildUseVoiceHookActionRuntimeEffectsControllerResolvedOptions/);
  assert.match(hookActionRuntimeEffectsControllerOptionsSource, /buildUseVoiceHookActionRuntimeEffectsStateOptions/);
  assert.match(hookActionRuntimeEffectsControllerOptionsSource, /buildUseVoiceHookActionRuntimeEffectsCoreRuntimeOptions/);
  assert.match(hookActionRuntimeEffectsControllerOptionsSource, /buildUseVoiceHookActionRuntimeEffectsEnvironment/);
  assert.match(hookActionRuntimeEffectsStateOptionsSource, /export function buildUseVoiceHookActionRuntimeEffectsStateOptions/);
  assert.match(hookActionRuntimeEffectsCoreRuntimeOptionsSource, /export function buildUseVoiceHookActionRuntimeEffectsCoreRuntimeOptions/);
  assert.match(hookActionRuntimeEffectsEnvironmentSource, /export function buildUseVoiceHookActionRuntimeEffectsEnvironment/);
  assert.match(hookActionRuntimeBuildersSource, /voiceHookActionSessionOptions/);
  assert.match(hookActionRuntimeBuildersSource, /voiceHookActionUiOptions/);
  assert.match(hookActionRuntimeBuildersSource, /voiceHookActionRuntimeEffectsOptions/);
  assert.match(hookActionSessionOptionsSource, /export function buildUseVoiceHookActionSessionOptions/);
  assert.match(hookActionUiOptionsSource, /export function buildUseVoiceHookActionUiOptions/);
  assert.match(hookActionRuntimeEffectsOptionsSource, /export function buildUseVoiceHookActionRuntimeEffectsOptions/);
  assert.match(hookCoreRuntimeControllerSource, /export function useVoiceHookCoreRuntimeController/);
  assert.match(hookCoreRuntimeControllerSource, /voiceHookCoreRuntimeControllerInputs/);
  assert.match(hookCoreRuntimeControllerSource, /buildUseVoiceHookScreenShareRuntimeInput/);
  assert.match(hookCoreRuntimeControllerSource, /buildUseVoiceHookSecurityRuntimeInput/);
  assert.match(hookCoreRuntimeControllerSource, /buildUseVoiceHookCaptureRuntimeInput/);
  assert.match(hookCoreRuntimeControllerSource, /buildUseVoiceHookMediaTransportRuntimeInput/);
  assert.match(hookCoreRuntimeControllerSource, /syncUseVoiceHookCoreRuntimeDeps/);
  assert.match(hookCoreRuntimeControllerSource, /buildUseVoiceHookCoreRuntimeValue/);
  assert.match(hookCoreRuntimeControllerSource, /useVoiceHookScreenShareController\(buildUseVoiceHookScreenShareRuntimeInput\(\{/);
  assert.match(hookCoreRuntimeControllerSource, /useVoiceHookSecurityController\(buildUseVoiceHookSecurityRuntimeInput\(\{/);
  assert.match(hookCoreRuntimeControllerSource, /useVoiceHookCaptureController\(buildUseVoiceHookCaptureRuntimeInput\(\{/);
  assert.match(hookCoreRuntimeControllerSource, /useVoiceHookMediaTransportController\(buildUseVoiceHookMediaTransportRuntimeInput\(\{/);
  assert.match(hookCoreRuntimeControllerInputsSource, /voiceHookScreenShareRuntimeInput/);
  assert.match(hookCoreRuntimeControllerInputsSource, /voiceHookSecurityRuntimeInput/);
  assert.match(hookCoreRuntimeControllerInputsSource, /voiceHookCaptureRuntimeInput/);
  assert.match(hookCoreRuntimeControllerInputsSource, /voiceHookMediaTransportRuntimeInput/);
  assert.match(hookCoreRuntimeControllerInputsSource, /voiceHookCoreRuntimeDepsSync/);
  assert.match(hookCoreRuntimeControllerInputsSource, /voiceHookCoreRuntimeValue/);
  assert.match(hookScreenShareRuntimeInputSource, /export function buildUseVoiceHookScreenShareRuntimeInput/);
  assert.match(hookSecurityRuntimeInputSource, /export function buildUseVoiceHookSecurityRuntimeInput/);
  assert.match(hookCaptureRuntimeInputSource, /export function buildUseVoiceHookCaptureRuntimeInput/);
  assert.match(hookMediaTransportRuntimeInputSource, /export function buildUseVoiceHookMediaTransportRuntimeInput/);
  assert.match(hookCoreRuntimeDepsSyncSource, /export function syncUseVoiceHookCoreRuntimeDeps/);
  assert.match(hookCoreRuntimeValueSource, /export function buildUseVoiceHookCoreRuntimeValue/);
  assert.match(hookScreenShareControllerSource, /export function useVoiceHookScreenShareController/);
  assert.match(hookScreenShareControllerSource, /import\s+\{\s*useVoiceHookScreenShareControllerRuntime\s*\}\s+from/);
  assert.match(hookScreenShareControllerSource, /import\s+\{\s*useVoiceHookScreenShareBridgeController\s*\}\s+from/);
  assert.match(hookScreenShareControllerSource, /useVoiceHookScreenShareBridgeController\(\)/);
  assert.match(hookScreenShareControllerSource, /useVoiceHookScreenShareControllerRuntime\(buildUseVoiceHookScreenShareControllerOptions\(\{/);
  assert.match(hookSecurityControllerSource, /export function useVoiceHookSecurityController/);
  assert.match(hookSecurityControllerSource, /import\s+\{\s*useVoiceHookSecurityControllerRuntime\s*\}\s+from/);
  assert.match(hookSecurityControllerSource, /buildUseVoiceHookSecurityRuntime\(buildUseVoiceHookSecurityRuntimeDeps\(\{/);
  assert.match(hookSecurityControllerSource, /useVoiceHookSecurityControllerRuntime\(buildUseVoiceHookSecurityControllerOptions\(\{/);
  assert.match(hookCaptureControllerSource, /export function useVoiceHookCaptureController/);
  assert.match(hookCaptureControllerSource, /import\s+\{\s*useVoiceHookCaptureControllerRuntime\s*\}\s+from/);
  assert.match(hookCaptureControllerSource, /buildUseVoiceHookCaptureRuntime\(buildUseVoiceHookCaptureRuntimeDeps\(\{/);
  assert.match(hookCaptureControllerSource, /useVoiceHookCaptureControllerRuntime\(buildUseVoiceHookCaptureControllerOptions\(\{/);
  assert.match(hookMediaTransportControllerSource, /export function useVoiceHookMediaTransportController/);
  assert.match(hookMediaTransportControllerSource, /import\s+\{\s*useVoiceHookMediaTransportControllerRuntime\s*\}\s+from/);
  assert.match(hookMediaTransportControllerSource, /buildUseVoiceHookMediaTransportRuntime\(buildUseVoiceHookMediaTransportRuntimeDeps\(\{/);
  assert.match(hookMediaTransportControllerSource, /useVoiceHookMediaTransportControllerRuntime\(buildUseVoiceHookMediaTransportControllerOptions\(\{/);
  assert.match(hookSessionActionsControllerSource, /export function useVoiceHookSessionActionsController/);
  assert.match(hookSessionActionsControllerSource, /import\s+\{\s*useVoiceHookSessionControllerRuntime\s*\}\s+from/);
  assert.match(hookSessionActionsControllerSource, /buildUseVoiceHookSessionControllerRuntimeValue\(\{/);
  assert.match(hookSessionActionsControllerSource, /useVoiceHookSessionControllerRuntime\(buildUseVoiceHookSessionControllerOptions\(\{/);
  assert.match(hookSessionActionsControllerSource, /constants:\s*\{/);
  assert.match(hookSessionActionsControllerSource, /deps,/);
  assert.match(hookUiActionsControllerSource, /export function useVoiceHookUiActionsController/);
  assert.match(hookUiActionsControllerSource, /import\s+\{\s*useVoiceHookUiControllerRuntime\s*\}\s+from/);
  assert.match(hookUiActionsControllerSource, /buildUseVoiceHookUiControllerRuntimeValue\(\{/);
  assert.match(hookUiActionsControllerSource, /useVoiceHookUiControllerRuntime\(buildUseVoiceHookUiControllerOptions\(\{/);
  assert.match(hookRuntimeEffectsControllerSource, /export function useVoiceHookRuntimeEffectsController/);
  assert.match(hookRuntimeEffectsControllerSource, /import\s+\{\s*useVoiceHookRuntimeBindingsControllerRuntime\s*\}\s+from/);
  assert.match(hookRuntimeEffectsControllerSource, /buildUseVoiceHookRuntimeBindingsControllerRuntimeValue\(\{/);
  assert.match(hookRuntimeEffectsControllerSource, /useVoiceHookRuntimeBindingsControllerRuntime\(buildUseVoiceHookRuntimeBindingsControllerOptions\(\{/);
  assert.match(hookCaptureControllerRuntimeSource, /export function useVoiceHookCaptureControllerRuntime/);
  assert.match(hookMediaTransportControllerRuntimeSource, /export function useVoiceHookMediaTransportControllerRuntime/);
  assert.match(hookSecurityControllerRuntimeSource, /export function useVoiceHookSecurityControllerRuntime/);
  assert.match(hookSessionControllerRuntimeSource, /export function useVoiceHookSessionControllerRuntime/);
  assert.match(hookSessionControllerRuntimeSource, /resolvedConstants/);
  assert.match(hookSessionControllerRuntimeSource, /resolvedDeps/);
  assert.match(hookUiControllerRuntimeSource, /export function useVoiceHookUiControllerRuntime/);
  assert.match(hookRuntimeBindingsControllerRuntimeSource, /export function useVoiceHookRuntimeBindingsControllerRuntime/);
  assert.match(hookScreenShareControllerRuntimeSource, /export function useVoiceHookScreenShareControllerRuntime/);
  assert.match(hookScreenShareRuntimeBridgeSource, /export function createVoiceHookScreenShareRuntimeBridge/);
  assert.match(hookScreenShareRuntimeBridgeSource, /export function createVoiceHookScreenShareRuntimeDeps/);
  assert.match(hookScreenShareRuntimeBridgeSource, /export function syncVoiceHookScreenShareRuntimeDeps/);
  assert.match(hookScreenShareBridgeControllerSource, /export function useVoiceHookScreenShareBridgeController/);
  assert.match(hookControllerBindingsSource, /export function buildUseVoiceHookSessionControllerOptions/);
  assert.match(hookControllerRuntimeDepsSource, /voiceHookSecurityRuntimeDeps/);
  assert.match(hookControllerRuntimeDepsSource, /voiceHookCaptureRuntimeDeps/);
  assert.match(hookControllerRuntimeDepsSource, /voiceHookMediaTransportRuntimeDeps/);
  assert.match(hookControllerRuntimeDepsSource, /voiceHookSessionRuntimeDeps/);
  assert.match(hookControllerRuntimeDepsSource, /voiceHookUiRuntimeDeps/);
  assert.match(hookControllerRuntimeDepsSource, /voiceHookRuntimeBindingsRuntimeDeps/);
  assert.match(hookSecurityRuntimeDepsSource, /export function buildUseVoiceHookSecurityRuntimeDeps/);
  assert.match(hookCaptureRuntimeDepsSource, /export function buildUseVoiceHookCaptureRuntimeDeps/);
  assert.match(hookMediaTransportRuntimeDepsSource, /export function buildUseVoiceHookMediaTransportRuntimeDeps/);
  assert.match(hookSessionRuntimeDepsSource, /export function buildUseVoiceHookSessionRuntimeDeps/);
  assert.match(hookUiRuntimeDepsSource, /export function buildUseVoiceHookUiRuntimeDeps/);
  assert.match(hookRuntimeBindingsRuntimeDepsSource, /export function buildUseVoiceHookRuntimeBindingsRuntimeDeps/);
  assert.match(hookControllerRuntimeBuildersSource, /voiceHookSessionRuntimeBuilders/);
  assert.match(hookControllerRuntimeBuildersSource, /voiceHookUiRuntimeBuilders/);
  assert.match(hookControllerRuntimeBuildersSource, /voiceHookRuntimeEffectsBuilders/);
  assert.match(hookControllerRuntimeBindingsSource, /voiceHookScreenShareRuntimeBindings/);
  assert.match(hookControllerRuntimeBindingsSource, /voiceHookSecurityRuntimeBindings/);
  assert.match(hookControllerRuntimeBindingsSource, /voiceHookCaptureRuntimeBindings/);
  assert.match(hookControllerRuntimeBindingsSource, /voiceHookMediaTransportRuntimeBindings/);
  assert.match(hookControllerRuntimeBindingsSource, /voiceHookSessionRuntimeBindings/);
  assert.match(hookControllerRuntimeBindingsSource, /voiceHookUiRuntimeBindings/);
  assert.match(hookControllerRuntimeBindingsSource, /voiceHookRuntimeBindingsRuntimeBindings/);
  assert.match(hookSessionRuntimeBuildersSource, /export function buildUseVoiceHookSessionControllerRuntimeValue/);
  assert.match(hookUiRuntimeBuildersSource, /export function buildUseVoiceHookUiControllerRuntimeValue/);
  assert.match(hookRuntimeEffectsBuildersSource, /export function buildUseVoiceHookRuntimeBindingsControllerRuntimeValue/);
  assert.match(hookScreenShareRuntimeBindingsSource, /export function buildUseVoiceHookScreenShareRuntime/);
  assert.match(hookSecurityRuntimeBindingsSource, /export function buildUseVoiceHookSecurityRuntime/);
  assert.match(hookCaptureRuntimeBindingsSource, /export function buildUseVoiceHookCaptureRuntime/);
  assert.match(hookMediaTransportRuntimeBindingsSource, /export function buildUseVoiceHookMediaTransportRuntime/);
  assert.match(hookSessionRuntimeBindingsSource, /export function buildUseVoiceHookSessionRuntime/);
  assert.match(hookUiRuntimeBindingsSource, /export function buildUseVoiceHookUiRuntime/);
  assert.match(hookRuntimeBindingsRuntimeBindingsSource, /export function buildUseVoiceHookRuntimeBindingsRuntime/);
});
