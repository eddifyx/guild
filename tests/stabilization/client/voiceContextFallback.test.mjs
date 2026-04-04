import test from 'node:test';
import assert from 'node:assert/strict';

import {
  defaultVoiceContextValue,
  defaultVoicePresenceContextValue,
  defaultVoiceSettingsContextValue,
  resetVoiceContextFallbackWarningsForTests,
  resolveVoiceContextValue,
} from '../../../client/src/contexts/voiceContextFallback.mjs';

test('voice context fallback returns inert defaults and warns once per context kind', () => {
  resetVoiceContextFallbackWarningsForTests();

  const warnings = [];
  const consoleRef = {
    warn(message) {
      warnings.push(message);
    },
  };

  assert.equal(
    resolveVoiceContextValue(null, { kind: 'voice', consoleRef }),
    defaultVoiceContextValue
  );
  assert.equal(
    resolveVoiceContextValue(null, { kind: 'voice', consoleRef }),
    defaultVoiceContextValue
  );
  assert.equal(
    resolveVoiceContextValue(null, { kind: 'presence', consoleRef }),
    defaultVoicePresenceContextValue
  );
  assert.equal(
    resolveVoiceContextValue(null, { kind: 'settings', consoleRef }),
    defaultVoiceSettingsContextValue
  );

  assert.equal(warnings.length, 3);
  assert.match(warnings[0], /voice context was used outside VoiceProvider/i);
  assert.match(warnings[1], /presence context was used outside VoiceProvider/i);
  assert.match(warnings[2], /settings context was used outside VoiceProvider/i);
});

test('voice context fallback preserves real provider values', () => {
  const actual = { channelId: 'voice-1', muted: true };
  assert.equal(resolveVoiceContextValue(actual, { kind: 'voice' }), actual);
});
