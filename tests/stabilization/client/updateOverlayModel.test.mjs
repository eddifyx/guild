import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUpdateOverlayLogoMetrics,
  buildUpdateOverlayViewState,
  normalizeUpdatePatchNotes,
} from '../../../client/src/features/update/updateOverlayModel.mjs';

test('update overlay model normalizes patch notes into canonical sections', () => {
  assert.deepEqual(
    normalizeUpdatePatchNotes([
      'Faster launch',
      'Cleaner updates',
    ]),
    {
      headline: null,
      summary: null,
      sections: [{ title: 'Highlights', items: ['Faster launch', 'Cleaner updates'] }],
    }
  );

  assert.deepEqual(
    normalizeUpdatePatchNotes({
      headline: '  Ready ',
      summary: '  Stable  ',
      sections: [
        { title: ' Notes ', items: [' One ', { title: 'Two', body: 'Body' }, { title: '', body: '' }] },
      ],
    }),
    {
      headline: 'Ready',
      summary: 'Stable',
      sections: [
        { title: 'Notes', items: [' One ', { title: 'Two', body: 'Body' }] },
      ],
    }
  );
});

test('update overlay model derives progress and manual-install state', () => {
  const viewState = buildUpdateOverlayViewState({
    progress: {
      phase: 'downloading',
      downloadedBytes: 2 * 1024 * 1024,
      totalBytes: 4 * 1024 * 1024,
      speed: 512 * 1024,
    },
    showPatchNotes: true,
    updateInfo: {
      updateStrategy: 'manual-install',
      remoteVersion: '1.2.3',
      localVersion: '1.2.2',
      releasedAt: 'March 25, 2026',
      patchNotes: 'Stable now',
      platformDownload: { installerUrl: 'https://guild.test/installer' },
      downloadPageUrl: 'https://guild.test/downloads',
    },
  });

  assert.equal(viewState.isManualInstall, true);
  assert.equal(viewState.primaryDownloadUrl, 'https://guild.test/installer');
  assert.equal(viewState.secondaryDownloadUrl, 'https://guild.test/downloads');
  assert.equal(viewState.progressPercent, 50);
  assert.equal(viewState.showPatchNotesPanel, true);
  assert.match(viewState.phaseLabel, /512 KB\/s/);
  assert.equal(viewState.versionMeta, 'Current v1.2.2 • New v1.2.3 • March 25, 2026');
});

test('update overlay model computes stable logo metrics', () => {
  const metrics = buildUpdateOverlayLogoMetrics({
    baseSize: 100,
    tilt: 12,
    outerStroke: 4,
    middleStroke: 3,
    middleInset: 10,
    innerInset: 20,
  }, 120);

  assert.deepEqual(metrics, {
    logoSize: 120,
    logoTilt: 12,
    outerStroke: 4.8,
    middleStroke: 3.6,
    middleInset: 12,
    innerInset: 24,
  });
});
