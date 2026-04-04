import {
  addPerfPhase,
  cancelPerfTrace,
  endPerfTrace,
  startPerfTrace,
} from '../../utils/devPerf.js';
import { scheduleVoiceLiveReconfigureFlow } from './voiceReconfigureFlow.mjs';

export function buildUseVoiceHookActionUiEnvironment() {
  return {
    scheduleVoiceLiveReconfigureFlowFn: scheduleVoiceLiveReconfigureFlow,
    clearTimeoutFn: clearTimeout,
    setTimeoutFn: window.setTimeout.bind(window),
    cancelPerfTraceFn: cancelPerfTrace,
    addPerfPhaseFn: addPerfPhase,
    startPerfTraceFn: startPerfTrace,
    endPerfTraceFn: endPerfTrace,
  };
}
