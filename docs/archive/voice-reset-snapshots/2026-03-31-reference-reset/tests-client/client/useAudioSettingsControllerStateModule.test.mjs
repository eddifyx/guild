import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('audio settings controller delegates local state and refs to a dedicated state hook', async () => {
  const controllerSource = await readFile(
    new URL('../../../client/src/features/voice/useAudioSettingsController.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/voice/useAudioSettingsControllerState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerSource, /from '\.\/useAudioSettingsControllerState\.mjs'/);
  assert.match(controllerSource, /useAudioSettingsControllerState\(/);
  assert.doesNotMatch(controllerSource, /const \[testing, setTesting\] = useState\(/);
  assert.doesNotMatch(controllerSource, /const streamRef = useRef\(/);

  assert.match(stateSource, /function useAudioSettingsControllerState\(/);
  assert.match(stateSource, /const \[testing, setTesting\] = useState\(false\)/);
  assert.match(stateSource, /const \[micGain, setMicGainLocal\] = useState\(\(\) =>/);
  assert.match(stateSource, /const streamRef = useRef\(null\)/);
  assert.match(stateSource, /const appleVoiceAvailableRef = useRef\(prefersAppleSystemVoiceIsolation\(\)\)/);
});
