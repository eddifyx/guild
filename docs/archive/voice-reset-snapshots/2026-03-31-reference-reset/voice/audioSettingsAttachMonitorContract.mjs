import {
  buildAudioSettingsAttachMonitorHandlerDeps,
  buildAudioSettingsAttachMonitorOutputHandlerOptions,
} from './audioSettingsControllerBindings.mjs';

function resolveWindowObject(windowObject) {
  return windowObject || globalThis.window || globalThis;
}

function resolveRuntimePlatform(windowObject) {
  try {
    return windowObject?.electronAPI?.getPlatform?.() || globalThis.process?.platform || null;
  } catch {
    return globalThis.process?.platform || null;
  }
}

export function buildAudioSettingsAttachMonitorContract({
  monitorGainRef,
  previewAudioRef,
  clearPreviewPlaybackFn,
  attachAudioSettingsMonitorOutputFn,
  ensureVoiceAudioHostFn,
  windowObject,
  AudioCtor,
  HTMLMediaElementCtor,
} = {}) {
  const resolvedWindow = resolveWindowObject(windowObject);
  const resolvedHTMLMediaElement = HTMLMediaElementCtor || globalThis.HTMLMediaElement;
  const preferPreviewMonitorOnDefault = resolveRuntimePlatform(resolvedWindow) !== 'darwin';
  return buildAudioSettingsAttachMonitorOutputHandlerOptions({
    monitorGainRef,
    previewAudioRef,
    clearPreviewPlaybackFn,
    ...buildAudioSettingsAttachMonitorHandlerDeps({
      attachAudioSettingsMonitorOutputFn,
      ensureVoiceAudioHostFn,
      performanceNowFn: () => performance.now(),
      audioCtor: AudioCtor || globalThis.Audio,
      setTimeoutFn: resolvedWindow.setTimeout.bind(resolvedWindow),
      haveMetadataReadyState: resolvedHTMLMediaElement?.HAVE_METADATA,
      // On macOS default-output monitor tests are more reliable through the
      // direct AudioContext destination path than the hidden preview element.
      preferPreviewMonitorOnDefault,
    }),
  });
}
