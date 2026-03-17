const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPlatform: () => process.platform,
  getPlatformTarget: () => (process.platform === 'darwin'
    ? `darwin-${process.arch}`
    : `${process.platform}-${process.arch}`),
  showNotification: (title, body) =>
    ipcRenderer.invoke('show-notification', { title, body }),
  getAppVersion: () =>
    ipcRenderer.invoke('get-app-version'),
  isAppleVoiceCaptureSupported: () => ipcRenderer.invoke('apple-voice-capture-supported'),
  primeAppleVoiceCapture: () => ipcRenderer.invoke('apple-voice-capture-prime'),
  startAppleVoiceCapture: (ownerId) => ipcRenderer.invoke('apple-voice-capture-start', ownerId),
  stopAppleVoiceCapture: (ownerId) => ipcRenderer.invoke('apple-voice-capture-stop', ownerId),
  onAppleVoiceCaptureFrame: (callback) => {
    const handler = (_event, chunk) => callback(chunk);
    ipcRenderer.on('apple-voice-capture-frame', handler);
    return () => ipcRenderer.removeListener('apple-voice-capture-frame', handler);
  },
  onAppleVoiceCaptureState: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('apple-voice-capture-state', handler);
    return () => ipcRenderer.removeListener('apple-voice-capture-state', handler);
  },
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  restartApp: () => ipcRenderer.invoke('app-relaunch'),
  downloadUpdate: (serverUrl) => ipcRenderer.invoke('download-update', serverUrl),
  applyUpdate: (info) => ipcRenderer.invoke('apply-update', info),
  onUpdateProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('update-progress', handler);
    return () => ipcRenderer.removeListener('update-progress', handler);
  },
  prefetchDesktopSources: () => ipcRenderer.invoke('prefetch-desktop-sources'),
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  getDesktopWindows: () => ipcRenderer.invoke('get-desktop-windows'),
  getDesktopThumbnails: () => ipcRenderer.invoke('get-desktop-thumbnails'),
  selectDesktopSource: (sourceId) => ipcRenderer.invoke('select-desktop-source', sourceId),
  getScreenCaptureAccessStatus: () => ipcRenderer.invoke('get-screen-capture-access-status'),
  openScreenCaptureSettings: () => ipcRenderer.invoke('open-screen-capture-settings'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  messageCacheGet: (userId, messageId) => ipcRenderer.invoke('message-cache:get', userId, messageId),
  messageCacheSet: (userId, messageId, entry) => ipcRenderer.invoke('message-cache:set', userId, messageId, entry),
  messageCacheDelete: (userId, messageId) => ipcRenderer.invoke('message-cache:delete', userId, messageId),
  logPerfSample: (sample) => ipcRenderer.send('perf:sample', sample),
  getPerfSamples: () => ipcRenderer.invoke('perf:get-samples'),
});

// Expose libsignal crypto operations (all key material stays in main process).
contextBridge.exposeInMainWorld('signalCrypto', {
  initialize: (userId) => ipcRenderer.invoke('signal:initialize', userId),
  destroy: () => ipcRenderer.invoke('signal:destroy'),
  getBundle: () => ipcRenderer.invoke('signal:get-bundle'),
  processBundle: (recipientId, bundle) =>
    ipcRenderer.invoke('signal:process-bundle', recipientId, bundle),
  getIdentityState: (recipientId, identityKey = null) =>
    ipcRenderer.invoke('signal:get-identity-state', recipientId, identityKey),
  approveIdentity: (recipientId, identityKey, options) =>
    ipcRenderer.invoke('signal:approve-identity', recipientId, identityKey, options),
  markIdentityVerified: (recipientId, identityKey) =>
    ipcRenderer.invoke('signal:mark-identity-verified', recipientId, identityKey),
  encrypt: (recipientId, plaintext) =>
    ipcRenderer.invoke('signal:encrypt', recipientId, plaintext),
  decrypt: (senderId, type, payload) =>
    ipcRenderer.invoke('signal:decrypt', senderId, type, payload),
  hasSession: (userId) => ipcRenderer.invoke('signal:has-session', userId),
  deleteSession: (userId) => ipcRenderer.invoke('signal:delete-session', userId),
  createSKDM: (roomId) => ipcRenderer.invoke('signal:create-skdm', roomId),
  processSKDM: (senderId, skdm) =>
    ipcRenderer.invoke('signal:process-skdm', senderId, skdm),
  groupEncrypt: (roomId, plaintext) =>
    ipcRenderer.invoke('signal:group-encrypt', roomId, plaintext),
  groupDecrypt: (senderId, roomId, payload) =>
    ipcRenderer.invoke('signal:group-decrypt', senderId, roomId, payload),
  rekeyRoom: (roomId) => ipcRenderer.invoke('signal:rekey-room', roomId),
  getFingerprint: (theirUserId, theirIdentityKey) =>
    ipcRenderer.invoke('signal:get-fingerprint', theirUserId, theirIdentityKey),
  replenishOTPs: (count) => ipcRenderer.invoke('signal:replenish-otps', count),
  replenishKyber: (count) => ipcRenderer.invoke('signal:replenish-kyber', count),
  otpCount: () => ipcRenderer.invoke('signal:otp-count'),
  kyberCount: () => ipcRenderer.invoke('signal:kyber-count'),
});
