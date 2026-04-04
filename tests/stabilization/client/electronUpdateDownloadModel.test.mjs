import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  DEFAULT_PROGRESS_INTERVAL_MS,
  DOWNLOAD_ARCHIVE_FILE_NAME,
  EXTRACTED_UPDATE_DIR_NAME,
  buildUpdatePlatformSlug,
  resolveUpdateArchiveUrl,
} = require('../../../client/electron/updateDownloadModel.js');

test('electron update download model resolves archive URLs and exposes canonical constants', () => {
  assert.equal(DEFAULT_PROGRESS_INTERVAL_MS, 500);
  assert.equal(DOWNLOAD_ARCHIVE_FILE_NAME, 'update.zip');
  assert.equal(EXTRACTED_UPDATE_DIR_NAME, 'extracted');
  assert.equal(buildUpdatePlatformSlug({ platform: 'darwin', arch: 'arm64' }), 'darwin-arm64');
  assert.equal(buildUpdatePlatformSlug({ platform: 'win32', arch: 'x64' }), 'win32-x64');
  assert.equal(
    resolveUpdateArchiveUrl(
      { archiveUrl: ' https://guild.test/update.zip ' },
      { legacyUpdateSlug: 'guild', platform: 'darwin', arch: 'arm64' }
    ),
    'https://guild.test/update.zip'
  );
  assert.equal(
    resolveUpdateArchiveUrl(
      { platformDownload: { archiveUrl: 'https://guild.test/platform.zip' } },
      { legacyUpdateSlug: 'guild', platform: 'darwin', arch: 'arm64' }
    ),
    'https://guild.test/platform.zip'
  );
  assert.equal(
    resolveUpdateArchiveUrl(
      { serverUrl: 'https://guild.test/' },
      { legacyUpdateSlug: 'guild', platform: 'darwin', arch: 'arm64' }
    ),
    'https://guild.test/updates/guild-latest-darwin-arm64.zip'
  );
  assert.equal(
    resolveUpdateArchiveUrl(
      'https://guild.test/',
      { legacyUpdateSlug: 'guild', platform: 'win32', arch: 'x64' }
    ),
    'https://guild.test/updates/guild-latest-win32-x64.zip'
  );
  assert.equal(resolveUpdateArchiveUrl(null, { legacyUpdateSlug: 'guild' }), null);
});
