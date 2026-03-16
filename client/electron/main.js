const { app, BrowserWindow, Menu, Tray, ipcMain, Notification, dialog, desktopCapturer, session, shell, safeStorage, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

function sanitizeProfileId(rawValue) {
  if (typeof rawValue !== 'string') return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized ? normalized.slice(0, 32) : null;
}

function getRuntimeProfile(argv = process.argv, env = process.env) {
  const envProfile = sanitizeProfileId(env.BYZANTINE_PROFILE);
  if (envProfile) return envProfile;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--profile') {
      return sanitizeProfileId(argv[i + 1]);
    }
    if (typeof arg === 'string' && arg.startsWith('--profile=')) {
      return sanitizeProfileId(arg.slice('--profile='.length));
    }
  }

  return null;
}

const PRODUCT_NAME = 'guild';
const PRODUCT_SLUG = 'guild';
const LEGACY_UPDATE_SLUG = 'Byzantine';
const PROFILE_ID = getRuntimeProfile();
const PROFILE_LABEL = PROFILE_ID ? ` (${PROFILE_ID})` : '';
let profilePartition = `persist:${PRODUCT_SLUG}-default`;

if (PROFILE_ID) {
  const defaultUserDataPath = app.getPath('userData');
  const profileUserDataPath = path.join(
    path.dirname(defaultUserDataPath),
    `${path.basename(defaultUserDataPath)}-profile-${PROFILE_ID}`
  );
  const profileSessionDataPath = path.join(profileUserDataPath, 'session');
  const profileLogsPath = path.join(profileUserDataPath, 'logs');
  const profileCachePath = path.join(profileUserDataPath, 'cache');

  fs.mkdirSync(profileUserDataPath, { recursive: true });
  fs.mkdirSync(profileSessionDataPath, { recursive: true });
  fs.mkdirSync(profileLogsPath, { recursive: true });
  fs.mkdirSync(profileCachePath, { recursive: true });

  app.setPath('userData', profileUserDataPath);
  app.setPath('sessionData', profileSessionDataPath);
  app.setPath('logs', profileLogsPath);
  app.commandLine.appendSwitch('user-data-dir', profileUserDataPath);
  app.commandLine.appendSwitch('disk-cache-dir', profileCachePath);
  profilePartition = `persist:${PRODUCT_SLUG}-profile-${PROFILE_ID}`;
}

function loadSignalBridge() {
  const candidates = [
    path.join(__dirname, '..', '..', 'electron', 'crypto', 'signalBridge.js'),
    path.join(__dirname, 'crypto', 'signalBridge.js'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  throw new Error('Unable to locate signalBridge.js. Checked: ' + candidates.join(', '));
}

const { registerSignalHandlers } = loadSignalBridge();

app.disableHardwareAcceleration();
app.setAppUserModelId(`${PRODUCT_SLUG}.${PROFILE_ID || 'default'}`);
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

// Single-instance lock for the active profile.
const gotTheLock = app.requestSingleInstanceLock({ profile: PROFILE_ID || 'default' });
if (!gotTheLock) {
  app.quit();
}

let mainWindow;
let tray = null;
let pendingSourceId = null;
const perfSamples = [];
const PERF_SAMPLE_LIMIT = 200;
const messageCacheStates = new Map();
const MESSAGE_CACHE_LIMIT = 400;
const MESSAGE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const APPLE_VOICE_HELPER_RELATIVE_DIR = path.join('electron', 'native', 'appleVoiceProcessing');
const APPLE_VOICE_HELPER_SOURCE_NAME = 'AppleVoiceIsolationCapture.swift';
const APPLE_VOICE_HELPER_BINARY_NAME = 'apple-voice-isolation-capture';

// Desktop source cache for Mac, pre-warmed when joining a voice channel.
// so the source picker opens instantly instead of waiting for desktopCapturer
let desktopSourceCache = { sources: null, windows: null, thumbnails: null, time: 0 };
let appleVoiceCaptureSession = null;
let appleVoiceCaptureStartPromise = null;
let appleVoiceCaptureDisabledReason = null;
let appleVoiceCaptureOwners = new Set();
const APPLE_VOICE_FIRST_FRAME_TIMEOUT_MS = 1200;

function encodeCacheSegment(value) {
  return Buffer.from(String(value || 'default'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function getMessageCacheDir() {
  const dir = path.join(app.getPath('userData'), 'message-cache');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getMessageCacheFilePath(userId) {
  return path.join(getMessageCacheDir(), `${encodeCacheSegment(userId)}.json`);
}

function pruneMessageCacheEntries(entries) {
  const now = Date.now();
  const normalized = Object.entries(entries || {})
    .filter(([messageId, entry]) => {
      if (!messageId || !entry || typeof entry !== 'object') return false;
      if (typeof entry.ciphertextHash !== 'string' || typeof entry.body !== 'string') return false;
      if (typeof entry.cachedAt !== 'number' || now - entry.cachedAt > MESSAGE_CACHE_TTL_MS) return false;
      return true;
    })
    .sort((a, b) => (a[1]?.cachedAt || 0) - (b[1]?.cachedAt || 0));

  while (normalized.length > MESSAGE_CACHE_LIMIT) {
    normalized.shift();
  }

  return Object.fromEntries(normalized);
}

function serializeMessageCache(entries) {
  const payload = JSON.stringify(entries || {});
  if (safeStorage.isEncryptionAvailable()) {
    return JSON.stringify({
      encrypted: true,
      payload: safeStorage.encryptString(payload).toString('base64'),
    });
  }

  return JSON.stringify({
    encrypted: false,
    payload,
  });
}

function deserializeMessageCache(raw) {
  if (!raw) return {};

  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') return {};

  const payload = parsed.encrypted
    ? safeStorage.decryptString(Buffer.from(parsed.payload, 'base64'))
    : parsed.payload;

  return typeof payload === 'string' ? JSON.parse(payload) : {};
}

function loadMessageCacheState(userId) {
  const key = String(userId || '');
  if (!key) return null;
  const existing = messageCacheStates.get(key);
  if (existing) return existing;

  let entries = {};
  let dirty = false;
  const filePath = getMessageCacheFilePath(key);

  if (fs.existsSync(filePath)) {
    try {
      entries = deserializeMessageCache(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.warn('[MessageCache] Failed to read persisted cache:', err?.message || err);
      entries = {};
      dirty = true;
    }
  }

  const prunedEntries = pruneMessageCacheEntries(entries);
  if (Object.keys(prunedEntries).length !== Object.keys(entries || {}).length) {
    entries = prunedEntries;
    dirty = true;
  } else {
    entries = prunedEntries;
  }

  const state = {
    userId: key,
    filePath,
    entries,
    dirty,
    flushTimer: null,
  };

  messageCacheStates.set(key, state);
  return state;
}

function flushMessageCacheState(userId) {
  const key = String(userId || '');
  const state = key ? messageCacheStates.get(key) : null;
  if (!state || !state.dirty) return;

  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
    state.flushTimer = null;
  }

  state.entries = pruneMessageCacheEntries(state.entries);

  try {
    const serialized = serializeMessageCache(state.entries);
    fs.writeFileSync(state.filePath, serialized, 'utf8');
    state.dirty = false;
  } catch (err) {
    console.warn('[MessageCache] Failed to flush persisted cache:', err?.message || err);
  }
}

function scheduleMessageCacheFlush(userId) {
  const state = loadMessageCacheState(userId);
  if (!state || state.flushTimer) return;

  state.flushTimer = setTimeout(() => {
    flushMessageCacheState(userId);
  }, 100);

  state.flushTimer.unref?.();
}

function flushAllMessageCacheStates() {
  for (const userId of messageCacheStates.keys()) {
    flushMessageCacheState(userId);
  }
}

function recordPerfSample(sample) {
  if (!sample || process.env.NODE_ENV === 'production') return;

  const normalized = {
    ...sample,
    receivedAt: new Date().toISOString(),
  };

  perfSamples.push(normalized);
  if (perfSamples.length > PERF_SAMPLE_LIMIT) {
    perfSamples.splice(0, perfSamples.length - PERF_SAMPLE_LIMIT);
  }

  try {
    console.info('[Perf]', JSON.stringify(normalized));
  } catch {
    console.info('[Perf]', normalized);
  }
}

function isAppleVoiceCapturePlatformSupported() {
  return process.platform === 'darwin' && process.arch === 'arm64';
}

function isAppleVoiceCaptureSupported() {
  return isAppleVoiceCapturePlatformSupported() && !appleVoiceCaptureDisabledReason;
}

function shouldDisableAppleVoiceCaptureForMessage(message = '') {
  const normalized = String(message || '').toLowerCase();
  return normalized.includes('could not initialize the audio unit')
    || normalized.includes('could not create the audio unit')
    || normalized.includes('could not configure')
    || normalized.includes('voiceprocessingi/o is unavailable')
    || normalized.includes('voiceprocessingio is unavailable');
}

function markAppleVoiceCaptureUnavailable(message) {
  if (!message || appleVoiceCaptureDisabledReason) {
    return;
  }

  appleVoiceCaptureDisabledReason = message;
  emitAppleVoiceCaptureState({
    type: 'unavailable',
    message,
  });
}

function getAppleVoiceHelperSourceCandidates() {
  return [
    path.join(__dirname, '..', '..', APPLE_VOICE_HELPER_RELATIVE_DIR, APPLE_VOICE_HELPER_SOURCE_NAME),
    path.join(__dirname, APPLE_VOICE_HELPER_RELATIVE_DIR.replace(/^electron\//, ''), APPLE_VOICE_HELPER_SOURCE_NAME),
  ];
}

function getAppleVoiceHelperBinaryCandidates() {
  return [
    path.join(__dirname, '..', '..', APPLE_VOICE_HELPER_RELATIVE_DIR, 'bin', APPLE_VOICE_HELPER_BINARY_NAME),
    path.join(__dirname, APPLE_VOICE_HELPER_RELATIVE_DIR.replace(/^electron\//, ''), 'bin', APPLE_VOICE_HELPER_BINARY_NAME),
  ];
}

function findExistingPath(candidates) {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function readJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function emitAppleVoiceCaptureState(payload) {
  mainWindow?.webContents.send('apple-voice-capture-state', payload);
}

function normalizeAppleVoiceCaptureOwnerId(ownerId) {
  if (typeof ownerId !== 'string') {
    return 'default';
  }
  const normalized = ownerId.trim();
  return normalized || 'default';
}

async function ensureAppleVoiceHelperBinary() {
  if (!isAppleVoiceCapturePlatformSupported()) {
    throw new Error('Apple voice processing is only available on Apple silicon Macs.');
  }

  const sourcePath = findExistingPath(getAppleVoiceHelperSourceCandidates());
  if (!sourcePath) {
    throw new Error('Apple voice helper source is missing from the app bundle.');
  }

  const packagedBinaryPath = findExistingPath(getAppleVoiceHelperBinaryCandidates());
  if (app.isPackaged) {
    if (!packagedBinaryPath) {
      throw new Error('Apple voice helper binary is missing from the packaged app.');
    }
    return packagedBinaryPath;
  }

  const binaryDir = path.join(path.dirname(sourcePath), 'bin');
  const binaryPath = packagedBinaryPath || path.join(binaryDir, APPLE_VOICE_HELPER_BINARY_NAME);
  const shouldCompile =
    !fs.existsSync(binaryPath)
    || fs.statSync(binaryPath).mtimeMs < fs.statSync(sourcePath).mtimeMs;

  if (!shouldCompile) {
    return binaryPath;
  }

  fs.mkdirSync(binaryDir, { recursive: true });
  const moduleCachePath = path.join(binaryDir, '.swift-module-cache');
  const tempDir = path.join(binaryDir, '.swift-tmp');
  fs.mkdirSync(moduleCachePath, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  await new Promise((resolve, reject) => {
    const compile = spawn(
      'swiftc',
      ['-module-cache-path', moduleCachePath, '-O', sourcePath, '-o', binaryPath],
      {
        env: {
          ...process.env,
          SWIFT_MODULECACHE_PATH: moduleCachePath,
          TMPDIR: tempDir,
        },
      }
    );
    let stderr = '';

    compile.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    compile.on('error', (error) => {
      reject(error);
    });

    compile.on('close', (code) => {
      if (code === 0) {
        fs.chmodSync(binaryPath, 0o755);
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `swiftc exited with code ${code}`));
    });
  });

  return binaryPath;
}

async function primeAppleVoiceCapture() {
  if (!isAppleVoiceCapturePlatformSupported()) {
    return { supported: false };
  }

  const binaryPath = await ensureAppleVoiceHelperBinary();
  return {
    supported: isAppleVoiceCaptureSupported(),
    binaryPath,
    disabledReason: appleVoiceCaptureDisabledReason,
  };
}

function stopAppleVoiceCaptureSession(ownerId = null, { force = false } = {}) {
  if (force) {
    appleVoiceCaptureOwners.clear();
  } else if (ownerId !== null) {
    appleVoiceCaptureOwners.delete(normalizeAppleVoiceCaptureOwnerId(ownerId));
  } else {
    appleVoiceCaptureOwners.clear();
  }

  if (appleVoiceCaptureOwners.size > 0) {
    return false;
  }

  const sessionState = appleVoiceCaptureSession;
  appleVoiceCaptureStartPromise = null;
  if (!sessionState) {
    return false;
  }

  appleVoiceCaptureSession = null;
  sessionState.stopping = true;
  sessionState.stdoutBuffer = Buffer.alloc(0);
  if (sessionState.firstFrameTimeout) {
    clearTimeout(sessionState.firstFrameTimeout);
    sessionState.firstFrameTimeout = null;
  }

  try {
    sessionState.proc.stdout.removeAllListeners('data');
    sessionState.proc.stderr.removeAllListeners('data');
  } catch {}

  try {
    sessionState.proc.kill('SIGTERM');
  } catch {}

  return true;
}

async function startAppleVoiceCaptureSession(ownerId = 'default') {
  if (!isAppleVoiceCaptureSupported()) {
    throw new Error(appleVoiceCaptureDisabledReason || 'Apple voice processing is unavailable on this Mac.');
  }

  const normalizedOwnerId = normalizeAppleVoiceCaptureOwnerId(ownerId);
  appleVoiceCaptureOwners.add(normalizedOwnerId);

  if (appleVoiceCaptureSession?.ready && appleVoiceCaptureSession.firstFrameReceived) {
    return appleVoiceCaptureSession.metadata;
  }

  if (appleVoiceCaptureStartPromise) {
    return appleVoiceCaptureStartPromise.catch((error) => {
      appleVoiceCaptureOwners.delete(normalizedOwnerId);
      throw error;
    });
  }

  stopAppleVoiceCaptureSession(null, { force: true });
  appleVoiceCaptureOwners.add(normalizedOwnerId);

  const helperBinary = await ensureAppleVoiceHelperBinary();
  const proc = spawn(helperBinary, [], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const sessionState = {
    proc,
    ready: false,
    stopping: false,
    metadata: null,
    stdoutBuffer: Buffer.alloc(0),
    frameBytes: 0,
    firstFrameReceived: false,
    firstFrameTimeout: null,
  };
  appleVoiceCaptureSession = sessionState;

  appleVoiceCaptureStartPromise = new Promise((resolve, reject) => {
    let settled = false;
    let stderrBuffer = '';

    const resolveOnce = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    proc.stdout.on('data', (chunk) => {
      if (!sessionState.ready || sessionState.frameBytes <= 0 || appleVoiceCaptureSession !== sessionState) {
        return;
      }

      sessionState.stdoutBuffer = Buffer.concat([sessionState.stdoutBuffer, chunk]);

      while (sessionState.stdoutBuffer.length >= sessionState.frameBytes) {
        const frame = sessionState.stdoutBuffer.subarray(0, sessionState.frameBytes);
        sessionState.stdoutBuffer = sessionState.stdoutBuffer.subarray(sessionState.frameBytes);
        if (!sessionState.firstFrameReceived) {
          sessionState.firstFrameReceived = true;
          if (sessionState.firstFrameTimeout) {
            clearTimeout(sessionState.firstFrameTimeout);
            sessionState.firstFrameTimeout = null;
          }
          resolveOnce(sessionState.metadata);
        }
        mainWindow?.webContents.send('apple-voice-capture-frame', frame);
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderrBuffer += chunk.toString();
      let newlineIndex = stderrBuffer.indexOf('\n');

      while (newlineIndex !== -1) {
        const line = stderrBuffer.slice(0, newlineIndex).trim();
        stderrBuffer = stderrBuffer.slice(newlineIndex + 1);

        if (line) {
          const payload = readJsonLine(line);
          if (payload?.type === 'ready') {
            sessionState.ready = true;
            sessionState.metadata = {
              backend: 'apple-voice-processing',
              sampleRate: payload.sampleRate || 48000,
              channels: payload.channels || 1,
              frameSamples: payload.frameSamples || 960,
              voiceProcessingEnabled: payload.voiceProcessingEnabled !== false,
              inputSampleRate: payload.inputSampleRate || null,
              inputChannels: payload.inputChannels || null,
              configuration: payload.configuration || null,
            };
            sessionState.frameBytes = sessionState.metadata.frameSamples * 2 * sessionState.metadata.channels;
            if (sessionState.firstFrameTimeout) {
              clearTimeout(sessionState.firstFrameTimeout);
            }
            sessionState.firstFrameTimeout = setTimeout(() => {
              if (
                settled
                || sessionState.stopping
                || sessionState.firstFrameReceived
                || appleVoiceCaptureSession !== sessionState
              ) {
                return;
              }

              const error = new Error('Mac voice cleanup was ready but microphone audio never arrived.');
              emitAppleVoiceCaptureState({
                type: 'error',
                message: error.message,
              });
              stopAppleVoiceCaptureSession(null, { force: true });
              rejectOnce(error);
            }, APPLE_VOICE_FIRST_FRAME_TIMEOUT_MS);
            sessionState.firstFrameTimeout.unref?.();
            emitAppleVoiceCaptureState({
              type: 'ready',
              ...sessionState.metadata,
            });
          } else if (payload?.type === 'error' || payload?.type === 'fatal') {
            const message = payload.message || 'Apple voice processing failed.';
            if (payload.type === 'fatal' && shouldDisableAppleVoiceCaptureForMessage(message)) {
              markAppleVoiceCaptureUnavailable(message);
            }
            if (payload.type === 'fatal' && !settled) {
              rejectOnce(new Error(message));
            } else {
              emitAppleVoiceCaptureState({
                type: 'error',
                message,
              });
            }
          }
        }

        newlineIndex = stderrBuffer.indexOf('\n');
      }
    });

    proc.on('error', (error) => {
      if (sessionState.firstFrameTimeout) {
        clearTimeout(sessionState.firstFrameTimeout);
        sessionState.firstFrameTimeout = null;
      }
      if (appleVoiceCaptureSession === sessionState) {
        appleVoiceCaptureSession = null;
        appleVoiceCaptureOwners.clear();
      }
      rejectOnce(error);
    });

    proc.on('close', (code, signal) => {
      if (sessionState.firstFrameTimeout) {
        clearTimeout(sessionState.firstFrameTimeout);
        sessionState.firstFrameTimeout = null;
      }
      const wasActiveSession = appleVoiceCaptureSession === sessionState;
      if (wasActiveSession) {
        appleVoiceCaptureSession = null;
        appleVoiceCaptureOwners.clear();
      }

      if (sessionState.stopping) {
        emitAppleVoiceCaptureState({ type: 'stopped' });
        resolveOnce(sessionState.metadata || null);
        return;
      }

      const error = new Error(
        stderrBuffer.trim() || `Apple voice processing exited unexpectedly (${signal || code || 'unknown'}).`
      );
      if (!sessionState.stopping && shouldDisableAppleVoiceCaptureForMessage(error.message)) {
        markAppleVoiceCaptureUnavailable(error.message);
      }
      emitAppleVoiceCaptureState({
        type: 'ended',
        code,
        signal,
        message: error.message,
      });
      rejectOnce(error);
    });
  });

  return appleVoiceCaptureStartPromise
    .finally(() => {
      if (appleVoiceCaptureStartPromise) {
        appleVoiceCaptureStartPromise = null;
      }
    })
    .catch((error) => {
      appleVoiceCaptureOwners.delete(normalizedOwnerId);
      throw error;
    });
}

function registerDisplayMediaHandler(targetSession) {
  if (!targetSession?.setDisplayMediaRequestHandler) return;

  targetSession.setDisplayMediaRequestHandler((request, callback) => {
    // Use zero-size thumbnails; we only need the source ID, not screenshots.
    desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } }).then((sources) => {
      const selectedSourceId = pendingSourceId;
      pendingSourceId = null;
      const selected = selectedSourceId ? sources.find(s => s.id === selectedSourceId) : null;
      const fallback = selected || sources[0];
      if (!fallback) {
        console.warn('[ScreenShare] No display sources available for getDisplayMedia request');
        callback({});
        return;
      }

      const response = { video: fallback };
      if (request.audioRequested && process.platform === 'win32') {
        response.audio = 'loopback';
      }
      callback(response);
    }).catch((err) => {
      pendingSourceId = null;
      console.warn('[ScreenShare] Failed to enumerate display sources:', err);
      callback({});
    });
  });
}

const APP_VERSION = app.getVersion();
const APP_DISPLAY_NAME = `/guild${PROFILE_LABEL}`;

function resolveAssetPath(...segments) {
  const candidates = [
    path.join(__dirname, '..', ...segments),
    path.join(__dirname, '..', '..', 'assets', segments[segments.length - 1]),
    path.join(__dirname, '..', '..', ...segments),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    title: APP_DISPLAY_NAME,
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    frame: false,
    icon: resolveAssetPath('assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: profilePartition,
      backgroundThrottling: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    // Auto-open DevTools in dev mode
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Allow F12 or Ctrl+Shift+I to toggle DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Context menu: always show Copy and Select All on right-click.
  mainWindow.webContents.on('context-menu', (e, params) => {
    e.preventDefault();
    const items = [
      { label: 'Copy', role: 'copy' },
      { label: 'Select All', role: 'selectAll' },
    ];
    if (params.isEditable) {
      items.push({ type: 'separator' }, { label: 'Paste', role: 'paste' });
    }
    Menu.buildFromTemplate(items).popup({ window: mainWindow });
  });

  // Windows: right-click taskbar icon shows custom menu with About
  mainWindow.on('system-context-menu', (event, point) => {
    event.preventDefault();
    Menu.buildFromTemplate([
      { label: `About ${APP_DISPLAY_NAME} v${APP_VERSION}`, click: () => showAboutDialog() },
      { type: 'separator' },
      { label: 'Minimize', click: () => mainWindow.minimize() },
      { label: mainWindow.isMaximized() ? 'Restore' : 'Maximize', click: () => {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
      }},
      { type: 'separator' },
      { label: 'Close', click: () => mainWindow.close() },
    ]).popup({ window: mainWindow, x: point.x, y: point.y });
  });
};

// About panel info (used by macOS native About and our custom dialog)
app.setAboutPanelOptions({
  applicationName: APP_DISPLAY_NAME,
  applicationVersion: APP_VERSION,
  version: APP_VERSION,
  copyright: '/guild encrypted messenger',
});

function showAboutDialog() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: `About ${APP_DISPLAY_NAME}`,
    message: APP_DISPLAY_NAME,
    detail: `Encrypted Messenger\nVersion ${APP_VERSION}`,
    buttons: ['OK'],
    icon: resolveAssetPath('assets', 'icon.png'),
  });
}

// macOS: app menu with About item + Edit menu for Cmd shortcuts
if (process.platform === 'darwin') {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { label: `About ${APP_DISPLAY_NAME}`, click: () => app.showAboutPanel() },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ]));
} else {
  Menu.setApplicationMenu(null);
}

// When a second instance launches (e.g. Jump List "About"), handle it here
app.on('second-instance', (event, commandLine) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  if (commandLine.includes('--show-about')) {
    showAboutDialog();
  }
});

app.whenReady().then(() => {
  registerSignalHandlers(ipcMain);
  createWindow();

  if (isAppleVoiceCaptureSupported()) {
    setTimeout(() => {
      void primeAppleVoiceCapture().catch((error) => {
        console.warn('[Voice] Apple voice helper warm-up failed:', error?.message || error);
      });
    }, 1200);
  }

  // Enable screen capture for getDisplayMedia() on both the default session
  // and the active profile partition used by this window.
  registerDisplayMediaHandler(session.defaultSession);
  registerDisplayMediaHandler(session.fromPartition(profilePartition));

  // Windows Jump List adds an About shortcut to the taskbar menu.
  if (process.platform === 'win32') {
    const aboutTaskArgs = PROFILE_ID
      ? `--profile=${PROFILE_ID} --show-about`
      : '--show-about';
    app.setUserTasks([
      {
        program: process.execPath,
        arguments: aboutTaskArgs,
        iconPath: process.execPath,
        iconIndex: 0,
        title: `About ${APP_DISPLAY_NAME} v${APP_VERSION}`,
        description: 'Show version info',
      },
    ]);
  }

  // If launched with --show-about (first instance), show dialog once window is ready
  if (process.argv.includes('--show-about')) {
    mainWindow.webContents.once('did-finish-load', () => showAboutDialog());
  }

  // macOS: dock right-click menu
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setMenu(Menu.buildFromTemplate([
      { label: `About ${APP_DISPLAY_NAME} v${APP_VERSION}`, click: () => app.showAboutPanel() },
    ]));
  }

  // Windows/Linux: system tray icon with right-click menu
  if (process.platform !== 'darwin') {
    const iconPath = resolveAssetPath('assets', 'icon.png');
    tray = new Tray(iconPath);
    tray.setToolTip(`${APP_DISPLAY_NAME} v${APP_VERSION}`);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: `About ${APP_DISPLAY_NAME} v${APP_VERSION}`, click: () => showAboutDialog() },
      { type: 'separator' },
      { label: 'Show', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { label: 'Quit', click: () => app.quit() },
    ]));
    tray.on('click', () => { mainWindow?.show(); mainWindow?.focus(); });
  }
});

app.on('before-quit', () => {
  stopAppleVoiceCaptureSession();
  flushAllMessageCacheStates();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Window control IPC
ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window-close', () => mainWindow?.close());
ipcMain.handle('app-relaunch', () => {
  try {
    app.relaunch();
    app.quit();
    return true;
  } catch (err) {
    console.warn('[App] Failed to relaunch:', err);
    return false;
  }
});

// App version IPC used by the renderer to compare against the server version.
ipcMain.handle('get-app-version', () => APP_VERSION);
ipcMain.handle('apple-voice-capture-supported', () => isAppleVoiceCaptureSupported());
ipcMain.handle('apple-voice-capture-prime', async () => {
  return primeAppleVoiceCapture();
});
ipcMain.handle('apple-voice-capture-start', async (_event, ownerId) => {
  return startAppleVoiceCaptureSession(ownerId);
});
ipcMain.handle('apple-voice-capture-stop', (_event, ownerId) => {
  return stopAppleVoiceCaptureSession(ownerId);
});

// Screen sharing: pre-fetch sources on Mac when joining a voice channel
// so the picker opens instantly later (desktopCapturer is slow on macOS)
ipcMain.handle('prefetch-desktop-sources', async () => {
  if (process.platform !== 'darwin') return;
  try {
    // Fetch screens first (fast, only 1-2 screens).
    const screenSources = await desktopCapturer.getSources({
      types: ['screen'], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false,
    });
    desktopSourceCache.sources = screenSources.map(s => ({ id: s.id, name: s.name, thumbnail: null }));
    desktopSourceCache.time = Date.now();

    // Then windows + thumbnails in parallel (slow, but happens in background before user clicks Share)
    const [windowSources, allSources] = await Promise.all([
      desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false }),
      desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 160, height: 90 }, fetchWindowIcons: false }),
    ]);
    desktopSourceCache.windows = windowSources.map(s => ({ id: s.id, name: s.name, thumbnail: null }));
    const thumbs = {};
    for (const s of allSources) thumbs[s.id] = s.thumbnail.toDataURL();
    desktopSourceCache.thumbnails = thumbs;
    desktopSourceCache.time = Date.now();
  } catch (err) {
    console.warn('Desktop source prefetch failed:', err);
  }
});

// Screen sharing: get available sources
// Windows: all sources + thumbnails in one fast call
// macOS: returns cached if pre-fetched, otherwise screens only (fast)
ipcMain.handle('get-desktop-sources', async () => {
  const isMac = process.platform === 'darwin';

  // Return cached data if fresh (Mac only)
  if (isMac && desktopSourceCache.sources && Date.now() - desktopSourceCache.time < 120000) {
    return desktopSourceCache.sources;
  }

  const sources = await desktopCapturer.getSources({
    types: isMac ? ['screen'] : ['screen', 'window'],
    thumbnailSize: isMac ? { width: 0, height: 0 } : { width: 160, height: 90 },
    fetchWindowIcons: false,
  });
  const result = sources.map(s => ({
    id: s.id,
    name: s.name,
    thumbnail: isMac ? null : s.thumbnail.toDataURL(),
  }));

  if (isMac) {
    desktopSourceCache.sources = result;
    desktopSourceCache.time = Date.now();
  }
  return result;
});

// Screen sharing: fetch windows separately (macOS only, window enumeration is deferred).
ipcMain.handle('get-desktop-windows', async () => {
  // Return cached if fresh
  if (desktopSourceCache.windows && Date.now() - desktopSourceCache.time < 120000) {
    return desktopSourceCache.windows;
  }

  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 0, height: 0 },
    fetchWindowIcons: false,
  });
  const result = sources.map(s => ({ id: s.id, name: s.name, thumbnail: null }));
  desktopSourceCache.windows = result;
  desktopSourceCache.time = Date.now();
  return result;
});

// Screen sharing: fetch thumbnails separately (macOS, loaded after picker is open).
ipcMain.handle('get-desktop-thumbnails', async () => {
  // Return cached if fresh
  if (desktopSourceCache.thumbnails && Date.now() - desktopSourceCache.time < 120000) {
    return desktopSourceCache.thumbnails;
  }

  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 160, height: 90 },
    fetchWindowIcons: false,
  });
  const thumbs = {};
  for (const s of sources) {
    thumbs[s.id] = s.thumbnail.toDataURL();
  }
  desktopSourceCache.thumbnails = thumbs;
  desktopSourceCache.time = Date.now();
  return thumbs;
});

// Screen sharing: user selected a source in the picker
ipcMain.handle('select-desktop-source', (event, sourceId) => {
  pendingSourceId = sourceId;
});

ipcMain.handle('get-screen-capture-access-status', () => {
  if (process.platform !== 'darwin') return 'granted';
  try {
    return systemPreferences.getMediaAccessStatus('screen');
  } catch (err) {
    console.warn('[ScreenShare] Failed to read screen capture permission:', err);
    return 'unknown';
  }
});

ipcMain.handle('open-screen-capture-settings', async () => {
  if (process.platform !== 'darwin') return false;
  try {
    await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
    return true;
  } catch (err) {
    console.warn('[ScreenShare] Failed to open Screen Recording settings:', err);
    return false;
  }
});

// Notification IPC
ipcMain.handle('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});

// E2E Encryption: safeStorage IPC for master key persistence via OS keychain
ipcMain.handle('safe-storage-available', () => safeStorage.isEncryptionAvailable());
ipcMain.handle('safe-storage-encrypt', (event, plaintext) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('safeStorage not available');
  return safeStorage.encryptString(plaintext).toString('base64');
});
ipcMain.handle('safe-storage-decrypt', (event, encrypted) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('safeStorage not available');
  return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
});

ipcMain.handle('message-cache:get', (event, userId, messageId) => {
  const state = loadMessageCacheState(userId);
  if (!state || !messageId) return null;

  const entry = state.entries[messageId];
  if (!entry) return null;

  if (Date.now() - (entry.cachedAt || 0) > MESSAGE_CACHE_TTL_MS) {
    delete state.entries[messageId];
    state.dirty = true;
    flushMessageCacheState(userId);
    return null;
  }

  return entry;
});

ipcMain.handle('message-cache:set', (event, userId, messageId, entry) => {
  const state = loadMessageCacheState(userId);
  if (!state || !messageId || !entry || typeof entry !== 'object') return false;

  state.entries[messageId] = {
    ciphertextHash: typeof entry.ciphertextHash === 'string' ? entry.ciphertextHash : '',
    body: typeof entry.body === 'string' ? entry.body : '',
    attachments: Array.isArray(entry.attachments) ? entry.attachments : [],
    cachedAt: typeof entry.cachedAt === 'number' ? entry.cachedAt : Date.now(),
  };
  state.entries = pruneMessageCacheEntries(state.entries);
  state.dirty = true;
  flushMessageCacheState(userId);
  return true;
});

ipcMain.handle('message-cache:delete', (event, userId, messageId) => {
  const state = loadMessageCacheState(userId);
  if (!state || !messageId) return false;
  if (!state.entries[messageId]) return false;

  delete state.entries[messageId];
  state.dirty = true;
  flushMessageCacheState(userId);
  return true;
});

ipcMain.on('perf:sample', (_event, sample) => {
  recordPerfSample(sample);
});

ipcMain.handle('perf:get-samples', () => perfSamples.slice());

// Open URL in system default browser
ipcMain.handle('open-external', (event, url) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

// Self-update: download zip from server
ipcMain.handle('download-update', async (event, serverUrl) => {
  const tempDir = path.join(os.tmpdir(), `${PRODUCT_SLUG}-update-` + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });
  const zipPath = path.join(tempDir, 'update.zip');
  const plat = process.platform === 'darwin' ? `darwin-${process.arch}` : `${process.platform}-${process.arch}`;
  // Keep the legacy update basename for one bridge release so existing installs
  // can still discover the renamed app build without a separate migration flow.
  const zipUrl = `${serverUrl}/updates/${LEGACY_UPDATE_SLUG}-latest-${plat}.zip`;

  return new Promise((resolve, reject) => {
    const client = zipUrl.startsWith('https') ? https : http;
    const req = client.get(zipUrl, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        return;
      }
      const totalBytes = parseInt(res.headers['content-length'], 10) || 0;
      let downloadedBytes = 0;
      const file = fs.createWriteStream(zipPath, { highWaterMark: 1024 * 1024 });

      // Throttle progress updates to avoid IPC backpressure slowing the download
      let lastProgressTime = 0;
      let lastProgressBytes = 0;
      const speedSamples = [];
      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const now = Date.now();
        const elapsed = now - lastProgressTime;
        if (elapsed >= 500 || downloadedBytes === totalBytes) {
          // Calculate instantaneous speed and add to moving average
          const instantSpeed = elapsed > 0 ? ((downloadedBytes - lastProgressBytes) / (elapsed / 1000)) : 0;
          speedSamples.push(instantSpeed);
          if (speedSamples.length > 5) speedSamples.shift(); // Keep last 5 samples
          const avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;

          lastProgressTime = now;
          lastProgressBytes = downloadedBytes;
          mainWindow?.webContents.send('update-progress', {
            phase: 'downloading',
            downloadedBytes,
            totalBytes,
            speed: avgSpeed,
          });
        }
      });

      res.pipe(file);
      file.on('finish', () => {
        file.close();
        // Send final progress update
        mainWindow?.webContents.send('update-progress', {
          phase: 'downloading',
          downloadedBytes,
          totalBytes,
        });
        resolve({ zipPath, tempDir });
      });
      file.on('error', (err) => {
        fs.unlink(zipPath, () => {});
        reject(err);
      });
    });
    req.on('error', reject);
  });
});

// Self-update: extract zip, write swap script, quit
ipcMain.handle('apply-update', async (event, { zipPath, tempDir }) => {
  // Guard: don't apply updates in dev mode; process.execPath points to node_modules/electron.
  if (!app.isPackaged) {
    throw new Error('Cannot apply updates in dev mode. Run from a packaged build to test the full update flow.');
  }
  mainWindow?.webContents.send('update-progress', { phase: 'extracting' });

  const extractDir = path.join(tempDir, 'extracted');

  if (process.platform === 'darwin') {
    // macOS: use unzip
    await new Promise((resolve, reject) => {
      fs.mkdirSync(extractDir, { recursive: true });
      const proc = spawn('unzip', ['-o', zipPath, '-d', extractDir], {
        stdio: 'ignore',
      });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Extraction failed (code ${code})`));
      });
      proc.on('error', reject);
    });
  } else {
    // Windows: use PowerShell
    await new Promise((resolve, reject) => {
      const ps = spawn('powershell.exe', [
        '-NoProfile', '-Command',
        `Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force`,
      ], {
        stdio: 'ignore',
      });
      ps.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Extraction failed (code ${code})`));
      });
      ps.on('error', reject);
    });
  }

  mainWindow?.webContents.send('update-progress', { phase: 'applying' });

  // The zip contains a single packaged app folder
  const entries = fs.readdirSync(extractDir);
  const sourceDir = entries.length === 1 && fs.statSync(path.join(extractDir, entries[0])).isDirectory()
    ? path.join(extractDir, entries[0])
    : extractDir;

  if (process.platform === 'darwin') {
    // macOS: find the .app bundle and replace the current one
    const appBundleName = `${PRODUCT_NAME}.app`;
    let newAppPath = path.join(sourceDir, appBundleName);

    // The app might be nested inside a folder, so search for it.
    if (!fs.existsSync(newAppPath)) {
      const findApp = (dir) => {
        for (const entry of fs.readdirSync(dir)) {
          const full = path.join(dir, entry);
          if (entry === appBundleName && fs.statSync(full).isDirectory()) return full;
          if (fs.statSync(full).isDirectory()) {
            const found = findApp(full);
            if (found) return found;
          }
        }
        return null;
      };
      newAppPath = findApp(extractDir) || newAppPath;
    }

    // Current .app bundle path: go up from the executable
    // Example: /Applications/<App>.app/Contents/MacOS/<App>
    const currentAppPath = process.execPath.replace(/\/Contents\/MacOS\/.*$/, '');
    const logPath = path.join(os.tmpdir(), `${PRODUCT_SLUG}-update.log`);

    // Shell script: kill app, replace the .app bundle, relaunch.
    const shPath = path.join(tempDir, 'update.sh');
    const shContent = [
      '#!/bin/bash',
      `echo "$(date) Update script started" > "${logPath}"`,
      `echo "newAppPath=${newAppPath}" >> "${logPath}"`,
      `echo "currentAppPath=${currentAppPath}" >> "${logPath}"`,
      `kill ${process.pid} 2>/dev/null`,
      'sleep 2',
      `rm -rf "${currentAppPath}" >> "${logPath}" 2>&1`,
      `cp -R "${newAppPath}" "${currentAppPath}" >> "${logPath}" 2>&1`,
      `echo "$(date) Copy done" >> "${logPath}"`,
      `open "${currentAppPath}"`,
      `echo "$(date) Relaunch issued" >> "${logPath}"`,
      `rm -rf "${tempDir}"`,
      '',
    ].join('\n');

    fs.writeFileSync(shPath, shContent);
    fs.chmodSync(shPath, '755');

    const child = spawn('/bin/bash', [shPath], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    app.quit();
  } else {
    // Windows: batch script with robocopy
    const appDir = path.dirname(process.execPath);
    const exeName = path.basename(process.execPath);
    const logPath = path.join(os.tmpdir(), `${PRODUCT_SLUG}-update.log`);
    const batPath = path.join(tempDir, 'update.bat');
    const batContent = [
      '@echo off',
      `echo [%date% %time%] Update script started > "${logPath}"`,
      `echo sourceDir=${sourceDir} >> "${logPath}"`,
      `echo appDir=${appDir} >> "${logPath}"`,
      `echo exeName=${exeName} >> "${logPath}"`,
      // Force-kill all app processes and wait for handles to release
      `taskkill /IM ${exeName} /F >NUL 2>&1`,
      `echo [%time%] Taskkill issued >> "${logPath}"`,
      'timeout /t 3 /nobreak >NUL',
      `echo [%time%] Starting robocopy >> "${logPath}"`,
      `robocopy "${sourceDir}" "${appDir}" /MIR /R:5 /W:2 >> "${logPath}" 2>&1`,
      `echo [%time%] Robocopy done (errorlevel=%errorlevel%) >> "${logPath}"`,
      `echo [%time%] Launching ${path.join(appDir, exeName)} >> "${logPath}"`,
      `start "" "${path.join(appDir, exeName)}"`,
      `echo [%time%] Launch command issued >> "${logPath}"`,
      '',
    ].join('\r\n');

    fs.writeFileSync(batPath, batContent);

    // VBScript wrapper to run the batch file with no visible window
    const vbsPath = path.join(tempDir, 'update.vbs');
    fs.writeFileSync(vbsPath, `CreateObject("Wscript.Shell").Run "cmd /c ""${batPath}""", 0, False\r\n`);

    const child = spawn('wscript.exe', [vbsPath], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    app.quit();
  }
});
