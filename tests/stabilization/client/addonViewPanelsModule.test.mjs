import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('addon view panels content delegates exports to the shared card view module', async () => {
  const panelsContentSource = await readFile(
    new URL('../../../client/src/components/Addons/AddonViewPanelsContent.jsx', import.meta.url),
    'utf8'
  );
  const panelsSource = await readFile(
    new URL('../../../client/src/components/Addons/AddonViewPanels.jsx', import.meta.url),
    'utf8'
  );
  const cardViewsSource = await readFile(
    new URL('../../../client/src/components/Addons/AddonViewCardViews.jsx', import.meta.url),
    'utf8'
  );
  const uploadViewsSource = await readFile(
    new URL('../../../client/src/components/Addons/AddonUploadSectionViews.jsx', import.meta.url),
    'utf8'
  );
  const libraryViewsSource = await readFile(
    new URL('../../../client/src/components/Addons/AddonLibraryCardViews.jsx', import.meta.url),
    'utf8'
  );

  assert.match(panelsContentSource, /AddonPendingAddonCardView/);
  assert.match(panelsContentSource, /from '\.\/AddonViewCardViews\.jsx'/);
  assert.match(panelsSource, /AddonPendingAddonCardView/);
  assert.match(cardViewsSource, /from '\.\/AddonUploadSectionViews\.jsx'/);
  assert.match(cardViewsSource, /from '\.\/AddonLibraryCardViews\.jsx'/);
  assert.match(uploadViewsSource, /export const AddonPendingAddonCardView/);
  assert.match(uploadViewsSource, /export const AddonUploadSectionView/);
  assert.match(libraryViewsSource, /export const AddonCardView/);
  assert.match(libraryViewsSource, /export function AddonGridView/);
});
