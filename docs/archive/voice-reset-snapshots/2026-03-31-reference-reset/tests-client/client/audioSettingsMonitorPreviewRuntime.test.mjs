import test from 'node:test';
import assert from 'node:assert/strict';

import { createAudioSettingsMonitorPreviewAudio } from '../../../client/src/features/voice/audioSettingsMonitorPreviewRuntime.mjs';

test('audio settings monitor preview runtime creates the canonical preview audio element and stores its ref', () => {
  class FakeAudio {
    constructor() {
      this.srcObject = null;
      this.autoplay = false;
      this.playsInline = false;
      this.volume = 0;
      this.muted = true;
      this.style = {
        setProperty: (key, value) => {
          this[key] = value;
        },
      };
    }
  }

  const previewAudioRef = { current: null };
  const previewDestination = { stream: { id: 'preview-stream' } };
  const appended = [];
  const host = {
    appendChild(node) {
      appended.push(node);
      node.parentNode = host;
    },
  };

  const previewAudio = createAudioSettingsMonitorPreviewAudio({
    audioCtor: FakeAudio,
    previewDestination,
    previewAudioRef,
    ensureVoiceAudioHostFn: () => host,
  });

  assert.equal(previewAudio.srcObject, previewDestination.stream);
  assert.equal(previewAudio.autoplay, true);
  assert.equal(previewAudio.playsInline, true);
  assert.equal(previewAudio.volume, 1);
  assert.equal(previewAudio.muted, false);
  assert.equal(previewAudio.display, 'none');
  assert.equal(previewAudioRef.current, previewAudio);
  assert.deepEqual(appended, [previewAudio]);
});
