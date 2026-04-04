export function createLoginScreenAuthChallengeHandler({
  setAuthChallengeUrlFn = () => {},
  setErrorFn = () => {},
} = {}) {
  return function handleAuthChallenge(event) {
    const url = event?.detail?.url;
    if (!url) return false;
    setAuthChallengeUrlFn(url);
    setErrorFn('Your signer requires an additional approval step before it can sign in.');
    return true;
  };
}

export function resolveLoginScreenQrErrorMessage(error, {
  timedOut = false,
} = {}) {
  const message = error?.message || 'QR connection failed. Refresh the code and try again.';
  if (timedOut) {
    return 'Signer did not connect to this QR code in time. Refresh the QR and scan again.';
  }
  if (/subscription closed before connection was established/i.test(message)) {
    return 'QR session expired before the signer connected. Refresh the code and scan again.';
  }
  if (/cancelled/i.test(message)) {
    return '';
  }
  return message;
}

export function startLoginScreenQrSession({
  server = '',
  getServerUrlFn = () => '',
  setServerUrlFn = () => {},
  clearNip46TraceFn = () => {},
  abortRef = { current: null },
  AbortControllerClass = AbortController,
  qrConnectionTimeoutMs = 45_000,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  createNostrConnectSessionFn = () => ({
    uri: '',
    waitForConnection: async () => ({}),
  }),
  nostrConnectLoginFn = async () => {},
  onLoginSuccessFn = () => {},
  setLoadingFn = () => {},
  setConnectURIFn = () => {},
  setErrorFn = () => {},
  setAuthChallengeUrlFn = () => {},
  setQrPhaseFn = () => {},
  setQrUriCopyStateFn = () => {},
  setShowQrAdvancedFn = () => {},
  setShowBunkerInputFn = () => {},
} = {}) {
  if (server !== getServerUrlFn()) {
    setServerUrlFn(server);
  }
  clearNip46TraceFn('qr_view_started');
  if (abortRef.current) abortRef.current.abort();

  const controller = new AbortControllerClass();
  abortRef.current = controller;
  let timedOut = false;
  let waitingForConnection = true;

  const timeoutId = setTimeoutFn(() => {
    if (!waitingForConnection) return;
    timedOut = true;
    controller.abort();
  }, qrConnectionTimeoutMs);

  setLoadingFn(false);
  setConnectURIFn('');
  setErrorFn('');
  setAuthChallengeUrlFn('');
  setQrPhaseFn('waiting_connection');
  setQrUriCopyStateFn('');
  setShowQrAdvancedFn(false);
  setShowBunkerInputFn(false);

  const { uri, waitForConnection } = createNostrConnectSessionFn({
    abortSignal: controller.signal,
    onConnected: () => {
      if (controller.signal.aborted) return;
      waitingForConnection = false;
      clearTimeoutFn(timeoutId);
      setLoadingFn(true);
      setQrPhaseFn('finishing_login');
    },
  });
  setConnectURIFn(uri);

  Promise.resolve()
    .then(() => waitForConnection())
    .then(async (result) => {
      waitingForConnection = false;
      clearTimeoutFn(timeoutId);
      if (controller.signal.aborted) return;
      setLoadingFn(true);
      try {
        await nostrConnectLoginFn(result);
        onLoginSuccessFn?.();
      } catch (error) {
        setErrorFn(error?.message || 'Login failed');
        setQrPhaseFn('idle');
      }
      setLoadingFn(false);
    })
    .catch((error) => {
      waitingForConnection = false;
      clearTimeoutFn(timeoutId);
      if (controller.signal.aborted && !timedOut) return;
      const message = resolveLoginScreenQrErrorMessage(error, { timedOut });
      if (message) {
        setErrorFn(message);
      }
      setQrPhaseFn('idle');
      setLoadingFn(false);
    });

  return function cleanupLoginScreenQrSession() {
    clearTimeoutFn(timeoutId);
    controller.abort();
    if (abortRef.current === controller) {
      abortRef.current = null;
    }
  };
}
