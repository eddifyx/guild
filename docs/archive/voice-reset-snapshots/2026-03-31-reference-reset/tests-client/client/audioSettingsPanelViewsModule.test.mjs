import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('audio settings panel views delegate shared and section-specific rendering to dedicated modules', async () => {
  const panelViewsSource = await readFile(
    new URL('../../../client/src/components/Voice/AudioSettingsPanelViews.jsx', import.meta.url),
    'utf8'
  );
  const inputPanelViewSource = await readFile(
    new URL('../../../client/src/components/Voice/AudioSettingsInputPanelView.jsx', import.meta.url),
    'utf8'
  );
  const optionPanelViewsSource = await readFile(
    new URL('../../../client/src/components/Voice/AudioSettingsOptionPanelViews.jsx', import.meta.url),
    'utf8'
  );
  const sharedPanelSource = await readFile(
    new URL('../../../client/src/components/Voice/AudioSettingsPanelShared.jsx', import.meta.url),
    'utf8'
  );

  assert.match(panelViewsSource, /from '\.\/AudioSettingsInputPanelView\.jsx'/);
  assert.match(panelViewsSource, /from '\.\/AudioSettingsOptionPanelViews\.jsx'/);
  assert.match(inputPanelViewSource, /from '\.\/AudioSettingsPanelShared\.jsx'/);
  assert.match(optionPanelViewsSource, /from '\.\/AudioSettingsPanelShared\.jsx'/);
  assert.match(sharedPanelSource, /export function PanelShell/);
  assert.match(sharedPanelSource, /export function SmallHint/);
  assert.match(sharedPanelSource, /export function ToggleOption/);
});
