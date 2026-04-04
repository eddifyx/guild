import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('main layout chrome delegates header and window controls to dedicated modules', async () => {
  const chromeSource = await readFile(
    new URL('../../../client/src/components/Layout/MainLayoutChrome.jsx', import.meta.url),
    'utf8'
  );
  const headerSource = await readFile(
    new URL('../../../client/src/components/Layout/MainLayoutConversationHeader.jsx', import.meta.url),
    'utf8'
  );
  const controlsSource = await readFile(
    new URL('../../../client/src/components/Layout/MainLayoutWindowControls.jsx', import.meta.url),
    'utf8'
  );
  const layoutSource = await readFile(
    new URL('../../../client/src/components/Layout/MainLayout.jsx', import.meta.url),
    'utf8'
  );

  assert.match(chromeSource, /from '\.\/MainLayoutConversationHeader\.jsx'/);
  assert.match(chromeSource, /from '\.\/MainLayoutWindowControls\.jsx'/);
  assert.match(headerSource, /export function ConversationHeaderContent/);
  assert.match(headerSource, /export function ConversationHeaderIcon/);
  assert.match(controlsSource, /export function MainLayoutWindowControls/);
  assert.match(layoutSource, /from '\.\/MainLayoutChrome\.jsx'/);
});
