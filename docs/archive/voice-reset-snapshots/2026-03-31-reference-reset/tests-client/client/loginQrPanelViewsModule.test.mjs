import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('login qr panel views delegates install and advanced sections to dedicated modules', async () => {
  const panelViewsSource = await readFile(
    new URL('../../../client/src/components/Auth/LoginQrPanelViews.jsx', import.meta.url),
    'utf8'
  );
  const installViewSource = await readFile(
    new URL('../../../client/src/components/Auth/LoginQrInstallView.jsx', import.meta.url),
    'utf8'
  );
  const advancedViewSource = await readFile(
    new URL('../../../client/src/components/Auth/LoginQrAdvancedView.jsx', import.meta.url),
    'utf8'
  );

  assert.match(panelViewsSource, /from '\.\/LoginQrInstallView\.jsx'/);
  assert.match(panelViewsSource, /from '\.\/LoginQrAdvancedView\.jsx'/);
  assert.match(installViewSource, /export function LoginQrInstallSection/);
  assert.match(advancedViewSource, /export function LoginQrAdvancedSection/);
});
