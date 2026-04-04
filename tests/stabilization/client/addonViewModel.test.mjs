import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAddonDownloadNoticeLabel,
  buildAddonFileViewState,
  buildAddonViewEmptyState,
  buildPendingAddonUploadState,
  formatAddonSize,
} from '../../../client/src/features/addons/addonViewModel.mjs';

test('addon view model formats file sizes across byte, kilobyte, and megabyte ranges', () => {
  assert.equal(formatAddonSize(999), '999 B');
  assert.equal(formatAddonSize(2048), '2.0 KB');
  assert.equal(formatAddonSize(3 * 1024 * 1024), '3.0 MB');
});

test('addon view model derives addon card state from the current user and file type', () => {
  assert.deepEqual(
    buildAddonFileViewState({
      addon: {
        uploaded_by: 'user-1',
        file_url: 'addons/test.png',
        file_type: 'image/png',
        file_size: 2048,
      },
      currentUserId: 'user-1',
      getFileUrlFn: (value) => `https://cdn.example/${value}`,
    }),
    {
      isOwner: true,
      url: 'https://cdn.example/addons/test.png',
      isImage: true,
      fileType: 'image/png',
      formattedSize: '2.0 KB',
    }
  );
});

test('addon view model derives pending upload state, empty state, and download labels', () => {
  assert.deepEqual(
    buildPendingAddonUploadState({
      pendingFile: { name: 'bundle.zip', size: 2048, type: 'application/zip' },
      uploadProgress: 42,
    }),
    {
      name: 'bundle.zip',
      size: 2048,
      type: 'application/zip',
      formattedSize: '2.0 KB',
      statusLabel: 'Uploading...',
      uploadProgress: 42,
    }
  );

  assert.deepEqual(
    buildAddonViewEmptyState({
      loading: false,
      addonCount: 0,
      hasPendingFile: false,
    }),
    {
      showLoading: false,
      showEmpty: true,
      showGrid: false,
    }
  );

  assert.equal(
    buildAddonDownloadNoticeLabel('bundle.zip'),
    'Downloading bundle.zip to your Downloads folder'
  );
});
