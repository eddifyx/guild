import { useAuth } from '../../contexts/AuthContext';
import { useLoginScreenControllerComposition } from './useLoginScreenControllerComposition.mjs';
import { useLoginScreenControllerState } from './useLoginScreenControllerState.mjs';
import { useLoginScreenControllerViewState } from './useLoginScreenControllerViewState.mjs';

export function useLoginScreenController({ onLoginSuccess } = {}) {
  const { nostrLogin, nostrConnectLogin, nsecLogin, createAccount } = useAuth();
  const state = useLoginScreenControllerState();
  const viewState = useLoginScreenControllerViewState({
    view: state.view,
    server: state.server,
    loading: state.loading,
    qrPhase: state.qrPhase,
    generatedAccount: state.generatedAccount,
    createImagePreview: state.createImagePreview,
    createPicture: state.createPicture,
    bunkerInput: state.bunkerInput,
    nsecInput: state.nsecInput,
    connectURI: state.connectURI,
  });
  const composition = useLoginScreenControllerComposition({
    onLoginSuccess,
    auth: {
      nostrLogin,
      nostrConnectLogin,
      nsecLogin,
      createAccount,
    },
    state,
  });

  return {
    view: state.view,
    error: state.error,
    loading: state.loading,
    server: state.server,
    setServer: state.setServer,
    showServer: state.showServer,
    setShowServer: state.setShowServer,
    qrSessionNonce: state.qrSessionNonce,
    setQrSessionNonce: state.setQrSessionNonce,
    authChallengeUrl: state.authChallengeUrl,
    qrPhase: state.qrPhase,
    qrUriCopyState: state.qrUriCopyState,
    showQrAdvanced: state.showQrAdvanced,
    setShowQrAdvanced: state.setShowQrAdvanced,
    showBunkerInput: state.showBunkerInput,
    setShowBunkerInput: state.setShowBunkerInput,
    bunkerInput: state.bunkerInput,
    setBunkerInput: state.setBunkerInput,
    connectURI: state.connectURI,
    nsecInput: state.nsecInput,
    setNsecInput: state.setNsecInput,
    generatedAccount: state.generatedAccount,
    createCopyState: state.createCopyState,
    showGeneratedNsec: state.showGeneratedNsec,
    setShowGeneratedNsec: state.setShowGeneratedNsec,
    createName: state.createName,
    setCreateName: state.setCreateName,
    createAbout: state.createAbout,
    setCreateAbout: state.setCreateAbout,
    createPicture: state.createPicture,
    setCreatePicture: state.setCreatePicture,
    createImageFile: state.createImageFile,
    setCreateImageFile: state.setCreateImageFile,
    createImageInputRef: state.createImageInputRef,
    showKeyPrimer: state.showKeyPrimer,
    setShowKeyPrimer: state.setShowKeyPrimer,
    ...composition,
    ...viewState,
  };
}
