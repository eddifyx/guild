import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createElectronIpcPerfRuntime,
} = require('../../../client/electron/electronIpcPerfRuntime.js');

test('electron IPC perf runtime writes debug logs and records perf samples outside production', () => {
  const appendedLogs = [];
  const readLogs = [];
  const infoLogs = [];
  const runtime = createElectronIpcPerfRuntime({
    fs: {
      appendFileSync(...args) {
        appendedLogs.push(args);
      },
      readFileSync(...args) {
        readLogs.push(args);
        return [
          '[2026-03-28T00:00:00.000Z] [voice] {"ok":true}',
          '[2026-03-28T00:00:01.000Z] [message-decrypt] {"event":"conversation-decrypt-failed"}',
          '[2026-03-28T00:00:02.000Z] [message-decrypt] {"event":"conversation-decrypt-recovered"}',
        ].join('\n');
      },
    },
    logger: {
      info(...args) {
        infoLogs.push(args);
      },
    },
    os: {
      tmpdir() {
        return '/tmp';
      },
    },
    path: {
      join: (...parts) => parts.join('/'),
    },
    productSlug: 'guild',
    processEnv: { NODE_ENV: 'development' },
  });

  runtime.appendDebugLog('debug', 'details');
  runtime.recordPerfSample({ fps: 60 });

  assert.equal(appendedLogs[0][0], '/tmp/guild-debug.log');
  assert.match(appendedLogs[0][1], /\[debug\] details/);
  assert.equal(infoLogs.length, 1);
  assert.equal(runtime.getPerfSamples().length, 1);
  assert.deepEqual(runtime.readDebugLogTail({ scope: 'message-decrypt', limit: 1 }), [
    '[2026-03-28T00:00:02.000Z] [message-decrypt] {"event":"conversation-decrypt-recovered"}',
  ]);
  assert.equal(readLogs[0][0], '/tmp/guild-debug.log');
});

test('electron IPC perf runtime ignores perf samples in production', () => {
  const runtime = createElectronIpcPerfRuntime({
    fs: {
      appendFileSync() {},
      readFileSync() {
        throw new Error('missing');
      },
    },
    logger: {
      info() {
        throw new Error('should not log perf samples in production');
      },
    },
    os: {
      tmpdir() {
        return '/tmp';
      },
    },
    path: {
      join: (...parts) => parts.join('/'),
    },
    productSlug: 'guild',
    processEnv: { NODE_ENV: 'production' },
  });

  runtime.recordPerfSample({ fps: 60 });
  assert.deepEqual(runtime.getPerfSamples(), []);
  assert.deepEqual(runtime.readDebugLogTail({ scope: 'message-decrypt' }), []);
});
