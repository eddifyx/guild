import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('login create panels delegates view exports to dedicated create modules', async () => {
  const panelsSource = await readFile(
    new URL('../../../client/src/components/Auth/LoginCreatePanels.jsx', import.meta.url),
    'utf8'
  );
  const headerSource = await readFile(
    new URL('../../../client/src/components/Auth/LoginCreateHeaderView.jsx', import.meta.url),
    'utf8'
  );
  const primerSource = await readFile(
    new URL('../../../client/src/components/Auth/LoginCreatePrimerView.jsx', import.meta.url),
    'utf8'
  );
  const identitySource = await readFile(
    new URL('../../../client/src/components/Auth/LoginCreateIdentityView.jsx', import.meta.url),
    'utf8'
  );
  const profileSource = await readFile(
    new URL('../../../client/src/components/Auth/LoginCreateProfileFieldsView.jsx', import.meta.url),
    'utf8'
  );
  const generateSource = await readFile(
    new URL('../../../client/src/components/Auth/LoginCreateGenerateButtonView.jsx', import.meta.url),
    'utf8'
  );
  const keysSource = await readFile(
    new URL('../../../client/src/components/Auth/LoginCreateGeneratedKeysView.jsx', import.meta.url),
    'utf8'
  );
  const actionsSource = await readFile(
    new URL('../../../client/src/components/Auth/LoginCreateActionsView.jsx', import.meta.url),
    'utf8'
  );

  assert.match(panelsSource, /from '\.\/LoginCreateHeaderView\.jsx'/);
  assert.match(panelsSource, /from '\.\/LoginCreatePrimerView\.jsx'/);
  assert.match(panelsSource, /from '\.\/LoginCreateIdentityView\.jsx'/);
  assert.match(panelsSource, /from '\.\/LoginCreateProfileFieldsView\.jsx'/);
  assert.match(panelsSource, /from '\.\/LoginCreateGenerateButtonView\.jsx'/);
  assert.match(panelsSource, /from '\.\/LoginCreateGeneratedKeysView\.jsx'/);
  assert.match(panelsSource, /from '\.\/LoginCreateActionsView\.jsx'/);
  assert.ok(headerSource.includes('LoginCreateHeader'));
  assert.ok(primerSource.includes('LoginCreatePrimer'));
  assert.ok(identitySource.includes('LoginCreateIdentitySection'));
  assert.ok(profileSource.includes('LoginCreateProfileFields'));
  assert.ok(generateSource.includes('LoginCreateGenerateButton'));
  assert.ok(keysSource.includes('LoginCreateGeneratedKeysSection'));
  assert.ok(actionsSource.includes('LoginCreateActions'));
});
