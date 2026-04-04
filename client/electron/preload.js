const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPlatform: () => process.platform,
  getPlatformTarget: () => (process.platform === 'darwin'
    ? `darwin-${process.arch}`
    : `${process.platform}-${process.arch}`),
  getAppFlavor: () => ipcRenderer.sendSync('get-app-flavor-sync'),
  isHardwareAccelerationEnabled: () => ipcRenderer.sendSync('get-hardware-acceleration-enabled-sync'),
  getGPUFeatureStatus: () => ipcRenderer.sendSync('get-gpu-feature-status-sync'),
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
  showSystemNotification: (payload) => ipcRenderer.invoke('system-notification:show', payload),
  onSystemNotificationAction: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('system-notification:action', handler);
    return () => ipcRenderer.removeListener('system-notification:action', handler);
  },
  prefetchDesktopSources: () => ipcRenderer.invoke('prefetch-desktop-sources'),
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  getDesktopWindows: () => ipcRenderer.invoke('get-desktop-windows'),
  getDesktopThumbnails: () => ipcRenderer.invoke('get-desktop-thumbnails'),
  selectDesktopSource: (sourceId) => ipcRenderer.invoke('select-desktop-source', sourceId),
  getScreenCaptureAccessStatus: () => ipcRenderer.invoke('get-screen-capture-access-status'),
  openScreenCaptureSettings: () => ipcRenderer.invoke('open-screen-capture-settings'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  authStateGetSync: () => ipcRenderer.sendSync('auth-state:get-sync'),
  authStateSet: (authData) => ipcRenderer.invoke('auth-state:set', authData),
  authStateClear: () => ipcRenderer.invoke('auth-state:clear'),
  signerStateGet: () => ipcRenderer.invoke('signer-state:get'),
  signerStateSet: (signerState) => ipcRenderer.invoke('signer-state:set', signerState),
  signerStateClear: () => ipcRenderer.invoke('signer-state:clear'),
  messageCacheGet: (userId, messageId) => ipcRenderer.invoke('message-cache:get', userId, messageId),
  messageCacheGetMany: (userId, messageIds) => ipcRenderer.invoke('message-cache:get-many', userId, messageIds),
  messageCacheSet: (userId, messageId, entry) => ipcRenderer.invoke('message-cache:set', userId, messageId, entry),
  messageCacheDelete: (userId, messageId) => ipcRenderer.invoke('message-cache:delete', userId, messageId),
  logPerfSample: (sample) => ipcRenderer.send('perf:sample', sample),
  getPerfSamples: () => ipcRenderer.invoke('perf:get-samples'),
  debugLog: (scope, details) => ipcRenderer.invoke('debug-log', scope, details),
  getDebugLogTail: (scope, limit) => ipcRenderer.invoke('debug-log:get-tail', scope, limit),
});

// Expose libsignal crypto operations (all key material stays in main process).
contextBridge.exposeInMainWorld('signalCrypto', {
  initialize: (userId) => ipcRenderer.invoke('signal:initialize', userId),
  destroy: () => ipcRenderer.invoke('signal:destroy'),
  resetLocalState: (userId = null) => ipcRenderer.invoke('signal:reset-local-state', userId),
  getDeviceId: () => ipcRenderer.invoke('signal:get-device-id'),
  setDeviceId: (deviceId) => ipcRenderer.invoke('signal:set-device-id', deviceId),
  allocateDeviceId: (excludedDeviceIds = []) => ipcRenderer.invoke('signal:allocate-device-id', excludedDeviceIds),
  getBundle: () => ipcRenderer.invoke('signal:get-bundle'),
  processBundle: (recipientId, recipientDeviceIdOrBundle, maybeBundle) => {
    const hasExplicitDeviceId = typeof recipientDeviceIdOrBundle === 'number';
    return ipcRenderer.invoke(
      'signal:process-bundle',
      recipientId,
      hasExplicitDeviceId ? recipientDeviceIdOrBundle : 1,
      hasExplicitDeviceId ? maybeBundle : recipientDeviceIdOrBundle,
    );
  },
  getIdentityState: (recipientId, recipientDeviceIdOrIdentityKey = 1, maybeIdentityKey = null) =>
    ipcRenderer.invoke(
      'signal:get-identity-state',
      recipientId,
      typeof recipientDeviceIdOrIdentityKey === 'number' ? recipientDeviceIdOrIdentityKey : 1,
      typeof recipientDeviceIdOrIdentityKey === 'number' ? maybeIdentityKey : recipientDeviceIdOrIdentityKey,
    ),
  approveIdentity: (recipientId, recipientDeviceIdOrIdentityKey = 1, maybeIdentityKey, maybeOptions) =>
    ipcRenderer.invoke(
      'signal:approve-identity',
      recipientId,
      typeof recipientDeviceIdOrIdentityKey === 'number' ? recipientDeviceIdOrIdentityKey : 1,
      typeof recipientDeviceIdOrIdentityKey === 'number' ? maybeIdentityKey : recipientDeviceIdOrIdentityKey,
      typeof recipientDeviceIdOrIdentityKey === 'number' ? maybeOptions : maybeIdentityKey,
    ),
  markIdentityVerified: (recipientId, recipientDeviceIdOrIdentityKey = 1, maybeIdentityKey) =>
    ipcRenderer.invoke(
      'signal:mark-identity-verified',
      recipientId,
      typeof recipientDeviceIdOrIdentityKey === 'number' ? recipientDeviceIdOrIdentityKey : 1,
      typeof recipientDeviceIdOrIdentityKey === 'number' ? maybeIdentityKey : recipientDeviceIdOrIdentityKey,
    ),
  encrypt: (recipientId, recipientDeviceIdOrPlaintext, maybePlaintext) =>
    ipcRenderer.invoke(
      'signal:encrypt',
      recipientId,
      typeof recipientDeviceIdOrPlaintext === 'number' ? recipientDeviceIdOrPlaintext : 1,
      typeof recipientDeviceIdOrPlaintext === 'number' ? maybePlaintext : recipientDeviceIdOrPlaintext,
    ),
  decrypt: (senderId, senderDeviceIdOrType, maybeType, maybePayload) =>
    ipcRenderer.invoke(
      'signal:decrypt',
      senderId,
      typeof senderDeviceIdOrType === 'number' ? senderDeviceIdOrType : 1,
      typeof senderDeviceIdOrType === 'number' ? maybeType : senderDeviceIdOrType,
      typeof senderDeviceIdOrType === 'number' ? maybePayload : maybeType,
    ),
  hasSession: (userId, recipientDeviceId = 1) =>
    ipcRenderer.invoke('signal:has-session', userId, typeof recipientDeviceId === 'number' ? recipientDeviceId : 1),
  deleteSession: (userId, recipientDeviceId = 1) =>
    ipcRenderer.invoke('signal:delete-session', userId, typeof recipientDeviceId === 'number' ? recipientDeviceId : 1),
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
