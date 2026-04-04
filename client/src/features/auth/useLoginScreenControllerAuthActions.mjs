import { getServerUrl, setServerUrl } from '../../api';
import {
  submitLoginScreenBunker,
  submitLoginScreenCreateAccount,
  submitLoginScreenNsec,
} from './loginScreenFlow.mjs';

export function useLoginScreenControllerAuthActions({
  onLoginSuccess,
  auth = {},
  state = {},
  stopQrSession = () => {},
} = {}) {
  const {
    nostrLogin = async () => {},
    nsecLogin = async () => {},
    createAccount = async () => {},
  } = auth;

  const {
    server = '',
    setError = () => {},
    setLoading = () => {},
    nsecInput = '',
    bunkerInput = '',
    setAuthChallengeUrl = () => {},
    generatedAccount = null,
    createName = '',
    createAbout = '',
    createPicture = '',
    createImageFile = null,
  } = state;

  const loginWithNsec = async (value) => {
    await submitLoginScreenNsec({
      value,
      server,
      getServerUrlFn: getServerUrl,
      setServerUrlFn: setServerUrl,
      nsecLoginFn: nsecLogin,
      onLoginSuccessFn: onLoginSuccess,
      setLoadingFn: setLoading,
      setErrorFn: setError,
    });
  };

  const handleNsecSubmit = async (event) => {
    event.preventDefault();
    await loginWithNsec(nsecInput);
  };

  const handleBunkerSubmit = async (event) => {
    await submitLoginScreenBunker({
      event,
      bunkerInput,
      stopQrSessionFn: stopQrSession,
      setLoadingFn: setLoading,
      setErrorFn: setError,
      setAuthChallengeUrlFn: setAuthChallengeUrl,
      server,
      getServerUrlFn: getServerUrl,
      setServerUrlFn: setServerUrl,
      nostrLoginFn: nostrLogin,
      onLoginSuccessFn: onLoginSuccess,
    });
  };

  const handleCreateAccountSubmit = async () => {
    await submitLoginScreenCreateAccount({
      generatedAccount,
      server,
      getServerUrlFn: getServerUrl,
      setServerUrlFn: setServerUrl,
      createAccountFn: createAccount,
      profile: {
        name: createName,
        about: createAbout,
        picture: createPicture,
      },
      profileImageFile: createImageFile,
      onLoginSuccessFn: onLoginSuccess,
      setLoadingFn: setLoading,
      setErrorFn: setError,
    });
  };

  return {
    handleNsecSubmit,
    handleBunkerSubmit,
    handleCreateAccountSubmit,
  };
}
