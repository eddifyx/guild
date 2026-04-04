import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('asset dump panels delegate upload, card, grid, empty, and notice rendering to dedicated modules', async () => {
  const panelsSource = await readFile(
    new URL('../../../client/src/components/AssetDump/AssetDumpPanels.jsx', import.meta.url),
    'utf8'
  );
  const uploadSource = await readFile(
    new URL('../../../client/src/components/AssetDump/AssetDumpUploadPanelView.jsx', import.meta.url),
    'utf8'
  );
  const emptySource = await readFile(
    new URL('../../../client/src/components/AssetDump/AssetDumpEmptyStateView.jsx', import.meta.url),
    'utf8'
  );
  const cardSource = await readFile(
    new URL('../../../client/src/components/AssetDump/AssetDumpCardViews.jsx', import.meta.url),
    'utf8'
  );
  const gridSource = await readFile(
    new URL('../../../client/src/components/AssetDump/AssetDumpGridView.jsx', import.meta.url),
    'utf8'
  );
  const noticeSource = await readFile(
    new URL('../../../client/src/components/AssetDump/AssetDownloadNoticeView.jsx', import.meta.url),
    'utf8'
  );

  assert.match(panelsSource, /from '\.\/AssetDumpUploadPanelView\.jsx'/);
  assert.match(panelsSource, /from '\.\/AssetDumpEmptyStateView\.jsx'/);
  assert.match(panelsSource, /from '\.\/AssetDumpGridView\.jsx'/);
  assert.match(panelsSource, /from '\.\/AssetDownloadNoticeView\.jsx'/);
  assert.match(uploadSource, /export function AssetDumpUploadPanel/);
  assert.match(emptySource, /export function AssetDumpEmptyState/);
  assert.match(cardSource, /export function AssetCard/);
  assert.match(cardSource, /export function PendingAssetCard/);
  assert.match(gridSource, /export function AssetDumpGrid/);
  assert.match(noticeSource, /export function AssetDownloadNotice/);
});
