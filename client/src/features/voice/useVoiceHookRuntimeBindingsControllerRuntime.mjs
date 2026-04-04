import { useVoiceRuntimeBindingsController } from './useVoiceRuntimeBindingsController.mjs';
import {
  buildVoiceRuntimeBindingsControllerOptions,
  buildVoiceRuntimeBindingsRuntime,
} from './voiceHookBindings.mjs';

export function useVoiceHookRuntimeBindingsControllerRuntime({
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  useVoiceRuntimeBindingsController(
    buildVoiceRuntimeBindingsControllerOptions({
      state,
      refs,
      runtime: buildVoiceRuntimeBindingsRuntime(runtime),
    })
  );
}
