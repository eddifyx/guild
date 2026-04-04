import { useLoginScreenQrEffects } from './useLoginScreenQrEffects.mjs';
import { useLoginScreenSupportEffects } from './useLoginScreenSupportEffects.mjs';

export function useLoginScreenControllerEffects({
  onLoginSuccess,
  auth = {},
  state = {},
} = {}) {
  useLoginScreenQrEffects({
    onLoginSuccess,
    auth,
    state,
  });

  useLoginScreenSupportEffects({ state });
}
