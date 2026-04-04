import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('update overlay panels delegate logo, patch notes, and card views to dedicated modules', async () => {
  const panelsSource = await readFile(
    new URL('../../../client/src/components/Common/UpdateOverlayPanels.jsx', import.meta.url),
    'utf8'
  );
  const logoSource = await readFile(
    new URL('../../../client/src/components/Common/UpdateOverlayLogoView.jsx', import.meta.url),
    'utf8'
  );
  const patchNotesSource = await readFile(
    new URL('../../../client/src/components/Common/UpdatePatchNotesPanelView.jsx', import.meta.url),
    'utf8'
  );
  const cardSource = await readFile(
    new URL('../../../client/src/components/Common/UpdateOverlayCardView.jsx', import.meta.url),
    'utf8'
  );
  const overlaySource = await readFile(
    new URL('../../../client/src/components/Common/UpdateOverlay.jsx', import.meta.url),
    'utf8'
  );

  assert.match(panelsSource, /UpdateOverlayLogo/);
  assert.match(panelsSource, /UpdatePatchNotesPanel/);
  assert.match(panelsSource, /UpdateOverlayCard/);
  assert.match(logoSource, /export function UpdateOverlayLogo/);
  assert.match(patchNotesSource, /export function UpdatePatchNotesPanel/);
  assert.match(cardSource, /from '\.\/UpdateOverlayLogoView\.jsx'/);
  assert.match(cardSource, /from '\.\/UpdatePatchNotesPanelView\.jsx'/);
  assert.match(cardSource, /export function UpdateOverlayCard/);
  assert.match(overlaySource, /from '\.\/UpdateOverlayPanels\.jsx'/);
});
