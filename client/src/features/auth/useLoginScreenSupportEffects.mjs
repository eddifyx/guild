import { useEffect } from 'react';

import {
  getAuthChallengeEventName,
} from '../../utils/nostrConnect';
import { syncLoginScreenImagePreview } from './loginScreenImagePreviewRuntime.mjs';
import {
  createLoginScreenAuthChallengeHandler,
} from './loginScreenQrRuntime.mjs';

export function useLoginScreenSupportEffects({
  state = {},
} = {}) {
  const {
    setAuthChallengeUrl = () => {},
    setError = () => {},
    createImageFile = null,
    setCreateImagePreview = () => {},
  } = state;

  useEffect(() => {
    const eventName = getAuthChallengeEventName();
    const handleAuthChallenge = createLoginScreenAuthChallengeHandler({
      setAuthChallengeUrlFn: setAuthChallengeUrl,
      setErrorFn: setError,
    });

    window.addEventListener(eventName, handleAuthChallenge);
    return () => window.removeEventListener(eventName, handleAuthChallenge);
  }, [setAuthChallengeUrl, setError]);

  useEffect(() => {
    return syncLoginScreenImagePreview({
      createImageFile,
      setCreateImagePreviewFn: setCreateImagePreview,
    });
  }, [createImageFile, setCreateImagePreview]);
}
