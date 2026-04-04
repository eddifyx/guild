import { useEffect, useMemo, useState } from 'react';

import {
  buildUpdateOverlayViewState,
  INITIAL_UPDATE_PROGRESS,
} from './updateOverlayModel.mjs';
import {
  beginOverlayUpdate,
  downloadAndApplyOverlayUpdate,
  openUpdateOverlayExternal,
  subscribeToUpdateOverlayProgress,
} from './updateOverlayRuntime.mjs';

export function useUpdateOverlayController({
  serverUrl,
  onDismiss = () => {},
  updateInfo = null,
}) {
  const [progress, setProgress] = useState(INITIAL_UPDATE_PROGRESS);
  const [error, setError] = useState(null);
  const [updateStarted, setUpdateStarted] = useState(false);
  const [showPatchNotes, setShowPatchNotes] = useState(false);
  const [preparingUpdate, setPreparingUpdate] = useState(false);

  const viewState = useMemo(() => buildUpdateOverlayViewState({
    progress,
    error,
    updateStarted,
    preparingUpdate,
    showPatchNotes,
    updateInfo,
  }), [error, preparingUpdate, progress, showPatchNotes, updateInfo, updateStarted]);

  useEffect(() => {
    if (viewState.isManualInstall || !updateStarted) {
      return undefined;
    }

    const cleanup = subscribeToUpdateOverlayProgress({
      electronApi: window.electronAPI,
      onProgress: setProgress,
    });

    let active = true;

    (async () => {
      try {
        await downloadAndApplyOverlayUpdate({
          electronApi: window.electronAPI,
          serverUrl,
          updateInfo,
        });
      } catch (runtimeError) {
        if (!active) {
          return;
        }

        setError(runtimeError?.message || 'Update failed');
        setUpdateStarted(false);
      }
    })();

    return () => {
      active = false;
      cleanup?.();
    };
  }, [serverUrl, updateInfo, updateStarted, viewState.isManualInstall]);

  async function onStartUpdate() {
    setError(null);
    setProgress(INITIAL_UPDATE_PROGRESS);
    setPreparingUpdate(true);

    try {
      const result = await beginOverlayUpdate({
        guildVoiceBridge: window.__guildVoiceBridge,
        electronApi: window.electronAPI,
        isManualInstall: viewState.isManualInstall,
        primaryDownloadUrl: viewState.primaryDownloadUrl,
        secondaryDownloadUrl: viewState.secondaryDownloadUrl,
      });

      if (result.startedNativeUpdate) {
        setUpdateStarted(true);
      }
    } catch (runtimeError) {
      setError(runtimeError?.message || 'Update preparation failed.');
    } finally {
      setPreparingUpdate(false);
    }
  }

  return {
    ...viewState,
    error,
    onDismiss,
    onStartUpdate,
    onOpenSecondaryDownload: () => openUpdateOverlayExternal({
      electronApi: window.electronAPI,
      url: viewState.secondaryDownloadUrl,
    }),
    onTogglePatchNotes: () => setShowPatchNotes((current) => !current),
  };
}
