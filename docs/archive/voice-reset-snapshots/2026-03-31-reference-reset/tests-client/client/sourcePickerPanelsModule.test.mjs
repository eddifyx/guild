import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('source picker delegates card and panel rendering to dedicated stream modules', async () => {
  const pickerSource = await readFile(
    new URL('../../../client/src/components/Stream/SourcePicker.jsx', import.meta.url),
    'utf8'
  );
  const cardSource = await readFile(
    new URL('../../../client/src/components/Stream/SourcePickerCard.jsx', import.meta.url),
    'utf8'
  );
  const panelsSource = await readFile(
    new URL('../../../client/src/components/Stream/SourcePickerPanels.jsx', import.meta.url),
    'utf8'
  );

  assert.match(pickerSource, /from '\.\/SourcePickerCard\.jsx'/);
  assert.match(pickerSource, /from '\.\/SourcePickerPanels\.jsx'/);
  assert.match(cardSource, /export function SourceCard/);
  assert.match(panelsSource, /export function SourcePickerSections/);
  assert.match(panelsSource, /export function SourcePickerAudioSection/);
  assert.match(panelsSource, /export function SourcePickerFooter/);
});
