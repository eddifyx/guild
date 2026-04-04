import { VOICE_PROCESSING_MODES } from '../utils/voiceProcessing.js';

const noop = () => {};
const asyncNoop = async () => {};

const missingProviderWarnings = {
  voice: false,
  presence: false,
  settings: false,
};

export const defaultVoiceContextValue = Object.freeze({
  channelId: null,
  muted: false,
  deafened: false,
  joinError: null,
  joinChannel: asyncNoop,
  leaveChannel: asyncNoop,
  toggleMute: noop,
  toggleDeafen: noop,
  setUserVolume: noop,
  voiceDiagnostics: null,
  screenSharing: false,
  screenShareStream: null,
  screenShareDiagnostics: null,
  startScreenShare: asyncNoop,
  stopScreenShare: asyncNoop,
  incomingScreenShares: [],
  showSourcePicker: false,
  confirmScreenShare: asyncNoop,
  cancelSourcePicker: noop,
  screenShareError: null,
  clearScreenShareError: noop,
  voiceE2E: false,
  e2eWarning: null,
  voiceStatus: null,
  refreshVoiceStatus: asyncNoop,
  voiceChannels: [],
  createVoiceChannel: asyncNoop,
  renameVoiceChannel: asyncNoop,
  deleteVoiceChannel: asyncNoop,
});

export const defaultVoicePresenceContextValue = Object.freeze({
  peers: {},
  speaking: false,
});

export const defaultVoiceSettingsContextValue = Object.freeze({
  inputDevices: [],
  outputDevices: [],
  selectedInput: '',
  selectedOutput: '',
  selectInput: noop,
  selectOutput: noop,
  refreshDevices: asyncNoop,
  setOutputDevice: asyncNoop,
  setUserVolume: noop,
  setMicGain: noop,
  voiceProcessingMode: VOICE_PROCESSING_MODES.STANDARD,
  setVoiceProcessingMode: noop,
  liveVoiceFallbackReason: null,
});

function warnMissingProviderOnce(kind, consoleRef = console) {
  if (missingProviderWarnings[kind]) return;
  missingProviderWarnings[kind] = true;
  consoleRef?.warn?.(
    `[VoiceContext] ${kind} context was used outside VoiceProvider. Falling back to inert defaults so the renderer stays alive.`
  );
}

export function resolveVoiceContextValue(ctx, {
  kind = 'voice',
  consoleRef = console,
} = {}) {
  if (ctx) return ctx;

  warnMissingProviderOnce(kind, consoleRef);

  if (kind === 'presence') {
    return defaultVoicePresenceContextValue;
  }
  if (kind === 'settings') {
    return defaultVoiceSettingsContextValue;
  }
  return defaultVoiceContextValue;
}

export function resetVoiceContextFallbackWarningsForTests() {
  missingProviderWarnings.voice = false;
  missingProviderWarnings.presence = false;
  missingProviderWarnings.settings = false;
}
