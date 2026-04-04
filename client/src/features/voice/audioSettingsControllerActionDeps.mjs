import { resolveAudioSettingsControllerMicTestActionDeps } from './audioSettingsControllerMicTestActionDeps.mjs';
import { resolveAudioSettingsControllerInteractionActionDeps } from './audioSettingsControllerInteractionActionDeps.mjs';

export function resolveAudioSettingsControllerActionDeps({
  deps = {},
} = {}) {
  return {
    ...resolveAudioSettingsControllerMicTestActionDeps({ deps }),
    ...resolveAudioSettingsControllerInteractionActionDeps({ deps }),
  };
}
