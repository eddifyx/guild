import test from 'node:test';
import assert from 'node:assert/strict';

import { syncLoginScreenImagePreview } from '../../../client/src/features/auth/loginScreenImagePreviewRuntime.mjs';

test('login screen image preview runtime clears preview when no file is selected', () => {
  let preview = 'old';
  const cleanup = syncLoginScreenImagePreview({
    createImageFile: null,
    setCreateImagePreviewFn: (value) => {
      preview = value;
    },
  });

  assert.equal(preview, '');
  assert.equal(cleanup, undefined);
});

test('login screen image preview runtime creates and revokes object urls for selected files', () => {
  let preview = '';
  const revoked = [];
  const cleanup = syncLoginScreenImagePreview({
    createImageFile: { name: 'avatar.png' },
    setCreateImagePreviewFn: (value) => {
      preview = value;
    },
    createObjectURLFn: () => 'blob:avatar-preview',
    revokeObjectURLFn: (value) => {
      revoked.push(value);
    },
  });

  assert.equal(preview, 'blob:avatar-preview');
  cleanup();
  assert.deepEqual(revoked, ['blob:avatar-preview']);
});
