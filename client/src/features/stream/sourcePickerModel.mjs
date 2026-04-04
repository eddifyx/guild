export const VIRTUAL_AUDIO_KEYWORDS = [
  'blackhole',
  'soundflower',
  'loopback audio',
  'vb-cable',
];

export function detectVirtualAudioDevices(devices = []) {
  return devices.filter((device) =>
    device.kind === 'audioinput'
    && VIRTUAL_AUDIO_KEYWORDS.some((keyword) => device.label.toLowerCase().includes(keyword))
  );
}

export function splitDesktopSources(sources = []) {
  return {
    screens: sources.filter((source) => source.id.startsWith('screen:')),
    windows: sources.filter((source) => source.id.startsWith('window:')),
  };
}

export function buildSourcePickerSelectionPayload({
  selectedSourceId,
  includeAudio = false,
  isMac = false,
  audioDetected = false,
  selectedAudioDevice = '',
} = {}) {
  if (!selectedSourceId) return null;
  return {
    sourceId: selectedSourceId,
    includeAudio,
    macAudioDeviceId: isMac && includeAudio && audioDetected ? selectedAudioDevice : null,
  };
}
