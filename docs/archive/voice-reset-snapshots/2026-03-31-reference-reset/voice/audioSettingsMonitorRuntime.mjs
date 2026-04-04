import { startAudioSettingsMonitorPlayback } from './audioSettingsMonitorPlaybackRuntime.mjs';
import { fallbackAudioSettingsMonitorOutput } from './audioSettingsMonitorFallbackRuntime.mjs';
import { attachAudioSettingsMonitorGraph } from './audioSettingsMonitorGraphRuntime.mjs';
import { createAudioSettingsMonitorPreviewAudio } from './audioSettingsMonitorPreviewRuntime.mjs';
import { buildAudioSettingsMonitorResult } from './audioSettingsMonitorResultModel.mjs';
import { applyAudioSettingsMonitorSinkId } from './audioSettingsMonitorSinkIdRuntime.mjs';

export function clearAudioSettingsPreviewPlayback(previewAudioRef = { current: null }) {
  if (previewAudioRef.current) {
    previewAudioRef.current.pause();
    previewAudioRef.current.srcObject = null;
    previewAudioRef.current.src = '';
    try {
      previewAudioRef.current.parentNode?.removeChild?.(previewAudioRef.current);
    } catch {}
    previewAudioRef.current = null;
  }
}

export async function attachAudioSettingsMonitorOutput({
  ctx,
  gainNode,
  activeOutputId,
  monitorProfile,
  preferDirectMonitor = false,
  refs = {},
  runtime = {},
} = {}) {
  const {
    monitorGainRef = { current: null },
    previewAudioRef = { current: null },
  } = refs;

  const {
    clearPreviewPlaybackFn = () => {},
    performanceNowFn = () => globalThis.performance?.now?.() ?? Date.now(),
    audioCtor = globalThis.Audio,
    setTimeoutFn = globalThis.setTimeout,
    haveMetadataReadyState = globalThis.HTMLMediaElement?.HAVE_METADATA ?? 1,
    preferPreviewMonitorOnDefault = false,
    ensureVoiceAudioHostFn = () => null,
  } = runtime;

  const previewStart = performanceNowFn();
  const hasExplicitOutputRouting = Boolean(activeOutputId && activeOutputId !== 'default');
  const { monitorGain } = attachAudioSettingsMonitorGraph({
    ctx,
    gainNode,
    monitorProfile,
    monitorGainRef,
  });

  if ((preferDirectMonitor || !hasExplicitOutputRouting) && !preferPreviewMonitorOnDefault) {
    monitorGain.connect(ctx.destination);
    return buildAudioSettingsMonitorResult({
      mode: 'direct',
      previewStart,
      performanceNowFn,
    });
  }

  const previewDestination = ctx.createMediaStreamDestination();
  monitorGain.connect(previewDestination);

  const previewAudio = createAudioSettingsMonitorPreviewAudio({
    audioCtor,
    previewDestination,
    previewAudioRef,
    ensureVoiceAudioHostFn,
  });

  if (!hasExplicitOutputRouting) {
    return startAudioSettingsMonitorPlayback({
      previewAudio,
      haveMetadataReadyState,
      setTimeoutFn,
      previewStart,
      performanceNowFn,
      fallbackArgs: {
        clearPreviewPlaybackFn,
        monitorGain,
        previewDestination,
        destination: ctx.destination,
        previewStart,
        performanceNowFn,
      },
    });
  }

  const sinkFallbackResult = await applyAudioSettingsMonitorSinkId({
    previewAudio,
    activeOutputId,
    fallbackArgs: {
      clearPreviewPlaybackFn,
      monitorGain,
      previewDestination,
      destination: ctx.destination,
      previewStart,
      performanceNowFn,
    },
  });

  if (sinkFallbackResult) {
    return sinkFallbackResult;
  }

  return startAudioSettingsMonitorPlayback({
    previewAudio,
    haveMetadataReadyState,
    setTimeoutFn,
    previewStart,
    performanceNowFn,
    fallbackArgs: {
      clearPreviewPlaybackFn,
      monitorGain,
      previewDestination,
      destination: ctx.destination,
      previewStart,
      performanceNowFn,
    },
  });
}
