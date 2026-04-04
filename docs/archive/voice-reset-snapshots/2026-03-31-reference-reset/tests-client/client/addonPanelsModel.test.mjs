import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAddonCardPanelState,
  buildAddonDownloadNoticeState,
  buildAddonGridPanelState,
  buildAddonUploadSectionState,
  buildPendingAddonCardState,
  getAddonFileIconVariant,
} from '../../../client/src/features/addons/addonPanelsModel.mjs';

test('addon panels model derives icon variants from file types', () => {
  assert.equal(getAddonFileIconVariant('image/png'), 'image');
  assert.equal(getAddonFileIconVariant('video/mp4'), 'video');
  assert.equal(getAddonFileIconVariant('audio/mpeg'), 'audio');
  assert.equal(getAddonFileIconVariant('application/zip'), 'archive');
  assert.equal(getAddonFileIconVariant('text/plain'), 'file');
});

test('addon panels model derives addon card state from the file view model', () => {
  assert.deepEqual(
    buildAddonCardPanelState({
      addon: {
        uploaded_by: 'user-1',
        file_url: 'addons/test.zip',
        file_type: 'application/zip',
        file_size: 2048,
      },
      currentUserId: 'user-1',
      getFileUrlFn: (value) => `https://cdn.example/${value}`,
    }),
    {
      isOwner: true,
      url: 'https://cdn.example/addons/test.zip',
      isImage: false,
      fileType: 'application/zip',
      formattedSize: '2.0 KB',
      iconVariant: 'archive',
      canDelete: true,
    }
  );
});

test('addon panels model derives grid state from loading and pending upload flags', () => {
  assert.deepEqual(
    buildAddonGridPanelState({
      loading: false,
      addons: [{ id: 'addon-1' }],
      pendingUpload: { name: 'bundle.zip' },
    }),
    {
      showLoading: false,
      showEmpty: false,
      showGrid: true,
    }
  );
});

test('addon panels model derives upload section state from upload and drag status', () => {
  assert.deepEqual(
    buildAddonUploadSectionState({
      uploading: true,
      dragOver: true,
      uploadError: 'Failed',
    }),
    {
      uploadButtonLabel: 'Uploading...',
      uploadButtonDisabled: true,
      uploadButtonCursor: 'not-allowed',
      uploadButtonBackground: 'var(--bg-tertiary)',
      uploadButtonColor: 'var(--text-muted)',
      dropZoneLabel: 'Drop file here',
      dropZoneBorderColor: 'var(--accent)',
      dropZoneColor: 'var(--accent)',
      dropZoneCursor: 'not-allowed',
      dropZoneBackground: 'rgba(64, 255, 64, 0.06)',
      showUploadError: true,
    }
  );
});

test('addon panels model shapes pending upload cards and download notices consistently', () => {
  assert.deepEqual(
    buildPendingAddonCardState({
      pendingUpload: {
        name: 'bundle.zip',
        type: 'application/zip',
        formattedSize: '2.0 KB',
        statusLabel: 'Uploading',
        uploadProgress: 42,
      },
    }),
    {
      name: 'bundle.zip',
      type: 'application/zip',
      formattedSize: '2.0 KB',
      statusLabel: 'Uploading',
      uploadProgress: 42,
      iconVariant: 'archive',
    }
  );

  assert.deepEqual(
    buildAddonDownloadNoticeState({
      fileName: 'bundle.zip',
    }),
    {
      label: 'Downloading bundle.zip to your Downloads folder',
    }
  );
});
