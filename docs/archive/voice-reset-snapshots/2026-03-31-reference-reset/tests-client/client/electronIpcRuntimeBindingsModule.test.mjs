import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron IPC runtime delegates option-bag shaping and guard creation to dedicated bindings', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRuntime.js', import.meta.url),
    'utf8'
  );
  const registrationRuntimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRegistrationRuntime.js', import.meta.url),
    'utf8'
  );
  const bindingsSource = await readFile(
    new URL('../../../client/electron/electronIpcRuntimeBindings.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/electronIpcRegistrationRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /const requireTrustedSender = \(event, scope\) =>/);
  assert.doesNotMatch(runtimeSource, /registerAppControlIpcHandlers\(\{/);
  assert.doesNotMatch(runtimeSource, /registerCaptureIpcHandlers\(\{/);
  assert.doesNotMatch(runtimeSource, /registerPersistedStateIpcHandlers\(\{/);
  assert.doesNotMatch(runtimeSource, /registerSystemIpcHandlers\(\{/);
  assert.match(registrationRuntimeSource, /require\('\.\/electronIpcRuntimeBindings'\)/);
  assert.doesNotMatch(registrationRuntimeSource, /const requireTrustedSender = \(event, scope\) =>/);
  assert.match(bindingsSource, /function createTrustedSenderGuard\(/);
  assert.match(bindingsSource, /function buildAppControlIpcOptions\(/);
  assert.match(bindingsSource, /function buildCaptureIpcOptions\(/);
  assert.match(bindingsSource, /function buildPersistedStateIpcOptions\(/);
  assert.match(bindingsSource, /function buildSystemIpcOptions\(/);
});
