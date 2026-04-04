import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('useMessages memoizes flow and runtime contracts before wiring the controller runtime', async () => {
  const source = await readFile(
    new URL('../../../client/src/hooks/useMessages.js', import.meta.url),
    'utf8'
  );

  assert.match(source, /import \{ useMemo, useRef, useState \} from 'react';/);
  assert.match(source, /const flowContracts = useMemo\(\(\) => buildUseMessagesFlowContracts\(/);
  assert.match(source, /const runtimeContracts = useMemo\(\(\) => buildUseMessagesRuntimeContracts\(/);
  assert.match(source, /flows: flowContracts,/);
  assert.match(source, /runtime: runtimeContracts,/);
});
