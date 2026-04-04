import { useMemo } from 'react';

import { buildLoginScreenFormState } from './loginScreenModel.mjs';

export function useLoginScreenControllerViewState({
  view = 'welcome',
  server = '',
  loading = false,
  qrPhase = 'idle',
  generatedAccount = null,
  createImagePreview = '',
  createPicture = '',
  bunkerInput = '',
  nsecInput = '',
  connectURI = '',
} = {}) {
  const formState = useMemo(() => buildLoginScreenFormState({
    server,
    loading,
    qrPhase,
    generatedAccount,
    createImagePreview,
    createPicture,
    bunkerInput,
    nsecInput,
    connectURI,
  }), [
    bunkerInput,
    connectURI,
    createImagePreview,
    createPicture,
    generatedAccount,
    loading,
    nsecInput,
    qrPhase,
    server,
  ]);

  return {
    isCreateView: view === 'create',
    ...formState,
  };
}
