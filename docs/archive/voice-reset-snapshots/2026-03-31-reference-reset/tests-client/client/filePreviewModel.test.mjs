import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFilePreviewAttachmentModel,
  buildFilePreviewLayoutStyles,
  formatFilePreviewSize,
} from '../../../client/src/features/messaging/filePreviewModel.mjs';

test('file preview model formats attachment metadata consistently', () => {
  const model = buildFilePreviewAttachmentModel({
    encryptionKey: 'key-1',
    encryptionDigest: 'digest-1',
    serverFileUrl: '/uploads/example.png',
    _previewUrl: 'blob:preview',
    originalFileName: 'example.png',
    originalFileType: 'image/png',
    originalFileSize: 2048,
  });

  assert.deepEqual(model, {
    encKey: 'key-1',
    encDigest: 'digest-1',
    serverUrl: '/uploads/example.png',
    localPreviewUrl: 'blob:preview',
    name: 'example.png',
    type: 'image/png',
    size: 2048,
    isEncrypted: true,
    isInlineMedia: true,
    attachmentKey: '/uploads/example.png|key-1|digest-1|example.png',
  });
});

test('file preview model formats sizes and layout styles', () => {
  assert.equal(formatFilePreviewSize(42), '42 B');
  assert.equal(formatFilePreviewSize(2048), '2.0 KB');
  assert.equal(formatFilePreviewSize(1024 * 1024), '1.0 MB');

  const compactStyles = buildFilePreviewLayoutStyles(true);
  const regularStyles = buildFilePreviewLayoutStyles(false);

  assert.deepEqual(compactStyles.previewBoxStyle, {
    marginTop: 4,
    maxWidth: 220,
  });
  assert.deepEqual(regularStyles.previewBoxStyle, {
    marginTop: 8,
    maxWidth: 400,
  });
  assert.equal(compactStyles.mediaStyle.objectFit, 'contain');
  assert.equal(regularStyles.mediaStyle.maxHeight, 300);
});
