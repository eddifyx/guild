import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sourcePath = new URL('../../../client/electron/native/appleVoiceProcessing/AppleVoiceIsolationCapture.swift', import.meta.url);

test('apple voice helper source keeps other-audio ducking at the minimum level and prefers capture-only mode', () => {
  const source = readFileSync(sourcePath, 'utf8');

  assert.match(source, /kAUVoiceIOProperty_OtherAudioDuckingConfiguration/);
  assert.match(source, /AUVoiceIOOtherAudioDuckingLevel\(rawValue: 10\)!/);
  assert.match(source, /AudioUnitConfiguration\(id: "capture-only", enableOutputBus: false\)/);
});
