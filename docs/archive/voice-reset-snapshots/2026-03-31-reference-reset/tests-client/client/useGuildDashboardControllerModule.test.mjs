import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild dashboard controller delegates state, view-state, and composition to dedicated owners', async () => {
  const controllerSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildDashboardController.mjs', import.meta.url),
    'utf8'
  );
  const compositionSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildDashboardControllerComposition.mjs', import.meta.url),
    'utf8'
  );
  const actionsSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildDashboardControllerActions.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildDashboardControllerState.mjs', import.meta.url),
    'utf8'
  );
  const viewStateSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildDashboardControllerViewState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerSource, /from '\.\/useGuildDashboardControllerComposition\.mjs'/);
  assert.match(controllerSource, /from '\.\/useGuildDashboardControllerState\.mjs'/);
  assert.match(controllerSource, /from '\.\/useGuildDashboardControllerViewState\.mjs'/);
  assert.match(controllerSource, /useGuildDashboardControllerState\(/);
  assert.match(controllerSource, /useGuildDashboardControllerViewState\(/);
  assert.match(controllerSource, /useGuildDashboardControllerComposition\(/);
  assert.doesNotMatch(controllerSource, /buildGuildDashboardStatusSubmit\(/);
  assert.doesNotMatch(controllerSource, /buildGuildDashboardProfileCardPayload\(/);
  assert.doesNotMatch(controllerSource, /buildGuildDashboardHeaderState\(/);
  assert.doesNotMatch(controllerSource, /const \[members, setMembers\] = useState\(/);

  assert.match(compositionSource, /useGuildDashboardControllerEffects\(/);
  assert.match(compositionSource, /useGuildDashboardControllerActions\(/);
  assert.match(actionsSource, /function useGuildDashboardControllerActions\(/);
  assert.match(stateSource, /function useGuildDashboardControllerState\(/);
  assert.match(viewStateSource, /function useGuildDashboardControllerViewState\(/);
});
