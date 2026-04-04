import { useEffect } from 'react';

import { getServerUrl, setServerUrl } from '../../api';
import { clearNip46Trace } from '../../utils/nip46Trace';
import {
  createNostrConnectSession,
} from '../../utils/nostrConnect';
import {
  startLoginScreenQrSession,
} from './loginScreenQrRuntime.mjs';

const QR_CONNECTION_TIMEOUT_MS = 45000;

export function useLoginScreenQrEffects({
  onLoginSuccess,
  auth = {},
  state = {},
} = {}) {
  const {
    nostrConnectLogin = async () => {},
  } = auth;

  const {
    abortRef = { current: null },
    view = 'welcome',
    server = '',
    qrSessionNonce = 0,
    setError = () => {},
    setLoading = () => {},
    setAuthChallengeUrl = () => {},
    setQrPhase = () => {},
    setQrUriCopyState = () => {},
    setShowQrAdvanced = () => {},
    setShowBunkerInput = () => {},
    setConnectURI = () => {},
  } = state;

  useEffect(() => {
    if (view !== 'qr') {
      return undefined;
    }
    return startLoginScreenQrSession({
      server,
      getServerUrlFn: getServerUrl,
      setServerUrlFn: setServerUrl,
      clearNip46TraceFn: clearNip46Trace,
      abortRef,
      qrConnectionTimeoutMs: QR_CONNECTION_TIMEOUT_MS,
      createNostrConnectSessionFn: createNostrConnectSession,
      nostrConnectLoginFn: nostrConnectLogin,
      onLoginSuccessFn: onLoginSuccess,
      setLoadingFn: setLoading,
      setConnectURIFn: setConnectURI,
      setErrorFn: setError,
      setAuthChallengeUrlFn: setAuthChallengeUrl,
      setQrPhaseFn: setQrPhase,
      setQrUriCopyStateFn: setQrUriCopyState,
      setShowQrAdvancedFn: setShowQrAdvanced,
      setShowBunkerInputFn: setShowBunkerInput,
    });
  }, [
    abortRef,
    nostrConnectLogin,
    onLoginSuccess,
    qrSessionNonce,
    server,
    setAuthChallengeUrl,
    setConnectURI,
    setError,
    setLoading,
    setQrPhase,
    setQrUriCopyState,
    setShowBunkerInput,
    setShowQrAdvanced,
    view,
  ]);
}
