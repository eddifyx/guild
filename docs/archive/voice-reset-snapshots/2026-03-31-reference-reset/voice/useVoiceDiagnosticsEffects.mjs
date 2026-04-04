import { useEffect } from 'react';

import {
  registerVoiceConsumerQualityEffect,
  registerVoiceDiagnosticsStatsEffect,
  registerVoiceScreenShareStatsEffect,
  syncVoiceScreenShareDiagnosticsEffect,
} from './voiceRuntimeEffects.mjs';
import { buildVoiceDiagnosticsDebugPayload } from './voiceDiagnosticsDebugModel.mjs';

export function useVoiceDiagnosticsEffects({
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  const {
    channelId = null,
    screenShareDiagnostics = null,
    screenSharing = false,
    joinError = null,
    liveVoiceFallbackReason = null,
    voiceDiagnostics = null,
  } = state;

  const {
    producerRef = { current: null },
    consumersRef = { current: new Map() },
    producerMetaRef = { current: new Map() },
    screenShareProducerRef = { current: null },
    screenShareStreamRef = { current: null },
    screenShareStatsRef = { current: null },
    screenShareProfileIndexRef = { current: 0 },
    screenShareSimulcastEnabledRef = { current: false },
    screenShareAdaptationRef = { current: null },
  } = refs;

  const {
    socket = null,
    summarizeProducerStatsFn = () => ({}),
    summarizeConsumerStatsFn = () => ({}),
    isVoiceDiagnosticsEnabledFn = () => false,
    getBitrateBpsFn = (value) => value,
    setScreenShareDiagnosticsFn = () => {},
    maybeAdaptScreenShareProfileFn = async () => {},
    summarizeTrackSnapshotFn = (value) => value,
    summarizeScreenShareProfileFn = (value) => value,
    summarizeScreenShareHardwareFn = (value) => value,
    screenShareProfiles = [],
    roundRateFn = (value) => value,
    updateVoiceDiagnosticsFn = () => {},
  } = runtime;

  useEffect(() => {
    return registerVoiceDiagnosticsStatsEffect({
      channelId,
      refs: {
        producerRef,
        consumersRef,
      },
      summarizeProducerStatsFn,
      summarizeConsumerStatsFn,
      updateVoiceDiagnosticsFn,
      isVoiceDiagnosticsEnabledFn,
      nowIsoFn: () => new Date().toISOString(),
      setIntervalFn: globalThis.window?.setInterval?.bind(globalThis.window) || globalThis.setInterval,
      clearIntervalFn: globalThis.window?.clearInterval?.bind(globalThis.window) || globalThis.clearInterval,
    });
  }, [
    channelId,
    producerRef,
    consumersRef,
    summarizeProducerStatsFn,
    summarizeConsumerStatsFn,
    updateVoiceDiagnosticsFn,
    isVoiceDiagnosticsEnabledFn,
  ]);

  useEffect(() => {
    return registerVoiceConsumerQualityEffect({
      channelId,
      socket,
      refs: {
        consumersRef,
        producerMetaRef,
      },
      summarizeConsumerStatsFn,
      getBitrateBpsFn,
      setIntervalFn: globalThis.window?.setInterval?.bind(globalThis.window) || globalThis.setInterval,
      clearIntervalFn: globalThis.window?.clearInterval?.bind(globalThis.window) || globalThis.clearInterval,
    });
  }, [
    channelId,
    socket,
    consumersRef,
    producerMetaRef,
    summarizeConsumerStatsFn,
    getBitrateBpsFn,
  ]);

  useEffect(() => {
    syncVoiceScreenShareDiagnosticsEffect({
      screenShareDiagnostics,
      isVoiceDiagnosticsEnabledFn,
      updateVoiceDiagnosticsFn,
    });
  }, [screenShareDiagnostics, isVoiceDiagnosticsEnabledFn, updateVoiceDiagnosticsFn]);

  useEffect(() => {
    if (!channelId || !voiceDiagnostics?.updatedAt) return;
    if (!globalThis.window?.electronAPI?.debugLog) return;

    const payload = buildVoiceDiagnosticsDebugPayload({
      channelId,
      joinError,
      liveVoiceFallbackReason,
      voiceDiagnostics,
    });
    if (!payload) return;

    try {
      globalThis.window.electronAPI.debugLog('voice-stats', JSON.stringify(payload));
    } catch {}
  }, [
    channelId,
    joinError,
    liveVoiceFallbackReason,
    voiceDiagnostics,
  ]);

  useEffect(() => {
    return registerVoiceScreenShareStatsEffect({
      screenSharing,
      refs: {
        screenShareProducerRef,
        screenShareStreamRef,
        screenShareStatsRef,
        screenShareProfileIndexRef,
        screenShareSimulcastEnabledRef,
        screenShareAdaptationRef,
      },
      setScreenShareDiagnosticsFn,
      maybeAdaptScreenShareProfileFn,
      summarizeProducerStatsFn,
      summarizeTrackSnapshotFn,
      summarizeScreenShareProfileFn,
      summarizeScreenShareHardwareFn,
      screenShareProfiles,
      roundRateFn,
      performanceNowFn: () => globalThis.performance?.now?.() ?? Date.now(),
      nowIsoFn: () => new Date().toISOString(),
      setIntervalFn: globalThis.window?.setInterval?.bind(globalThis.window) || globalThis.setInterval,
      clearIntervalFn: globalThis.window?.clearInterval?.bind(globalThis.window) || globalThis.clearInterval,
    });
  }, [
    screenSharing,
    screenShareProducerRef,
    screenShareStreamRef,
    screenShareStatsRef,
    screenShareProfileIndexRef,
    screenShareSimulcastEnabledRef,
    screenShareAdaptationRef,
    setScreenShareDiagnosticsFn,
    maybeAdaptScreenShareProfileFn,
    summarizeProducerStatsFn,
    summarizeTrackSnapshotFn,
    summarizeScreenShareProfileFn,
    summarizeScreenShareHardwareFn,
    screenShareProfiles,
    roundRateFn,
  ]);
}
