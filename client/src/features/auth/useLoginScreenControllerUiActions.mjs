import {
  copyLoginScreenValue,
  createGeneratedLoginScreenAccount,
  handleLoginScreenCreateImageSelection,
  resetLoginScreenView,
  stopLoginScreenQrSession,
} from './loginScreenFlow.mjs';

export function useLoginScreenControllerUiActions({ state = {} } = {}) {
  const {
    abortRef = { current: null },
    setView = () => {},
    setError = () => {},
    setLoading = () => {},
    setQrPhase = () => {},
    setQrUriCopyState = () => {},
    setShowQrAdvanced = () => {},
    setShowBunkerInput = () => {},
    setBunkerInput = () => {},
    connectURI = '',
    setNsecInput = () => {},
    setGeneratedAccount = () => {},
    setCreateCopyState = () => {},
    setShowGeneratedNsec = () => {},
    setCreateImageFile = () => {},
  } = state;

  const switchView = (nextView) => {
    resetLoginScreenView({
      nextView,
      setErrorFn: setError,
      setLoadingFn: setLoading,
      setCreateCopyStateFn: setCreateCopyState,
      setQrPhaseFn: setQrPhase,
      setQrUriCopyStateFn: setQrUriCopyState,
      setShowQrAdvancedFn: setShowQrAdvanced,
      setShowBunkerInputFn: setShowBunkerInput,
      setBunkerInputFn: setBunkerInput,
      setViewFn: setView,
    });
  };

  const copyQrUri = async () => {
    await copyLoginScreenValue({
      value: connectURI,
      successLabel: 'QR URI copied',
      failureLabel: 'QR URI copy failed',
      writeTextFn: navigator.clipboard.writeText.bind(navigator.clipboard),
      setCopyStateFn: setQrUriCopyState,
    });
  };

  const stopQrSession = () => {
    stopLoginScreenQrSession({
      abortRef,
      setQrPhaseFn: setQrPhase,
    });
  };

  const generateAccount = () => {
    const nextAccount = createGeneratedLoginScreenAccount();
    setGeneratedAccount(nextAccount);
    setNsecInput(nextAccount.nsec);
    setShowGeneratedNsec(false);
    setCreateCopyState('');
    setError('');
  };

  const handleCreateImageChange = (event) => {
    handleLoginScreenCreateImageSelection({
      event,
      setErrorFn: setError,
      setCreateImageFileFn: setCreateImageFile,
    });
  };

  const copyGeneratedValue = async (value, label) => {
    await copyLoginScreenValue({
      value,
      successLabel: label,
      writeTextFn: navigator.clipboard.writeText.bind(navigator.clipboard),
      setCopyStateFn: setCreateCopyState,
    });
  };

  const openExternalLink = (url) => window.electronAPI?.openExternal?.(url);

  return {
    switchView,
    copyQrUri,
    stopQrSession,
    generateAccount,
    handleCreateImageChange,
    copyGeneratedValue,
    openExternalLink,
    openPrimal: () => openExternalLink('https://primal.net'),
  };
}
