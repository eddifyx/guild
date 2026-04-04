import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('login screen controller ui actions own copy, reset, generation, image, and external-link handlers', async () => {
  const uiActionsSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenControllerUiActions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(uiActionsSource, /function useLoginScreenControllerUiActions\(/);
  assert.match(uiActionsSource, /copyLoginScreenValue\(/);
  assert.match(uiActionsSource, /createGeneratedLoginScreenAccount\(/);
  assert.match(uiActionsSource, /handleLoginScreenCreateImageSelection\(/);
  assert.match(uiActionsSource, /resetLoginScreenView\(/);
  assert.match(uiActionsSource, /stopLoginScreenQrSession\(/);
  assert.match(uiActionsSource, /copyQrUri/);
  assert.match(uiActionsSource, /switchView/);
  assert.match(uiActionsSource, /generateAccount/);
  assert.match(uiActionsSource, /openExternalLink/);
});
