import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('following modal controller delegates state and composition to dedicated owners', async () => {
  const controllerSource = await readFile(
    new URL('../../../client/src/features/social/useFollowingModalController.mjs', import.meta.url),
    'utf8'
  );
  const compositionSource = await readFile(
    new URL('../../../client/src/features/social/useFollowingModalControllerComposition.mjs', import.meta.url),
    'utf8'
  );
  const actionsSource = await readFile(
    new URL('../../../client/src/features/social/useFollowingModalControllerActions.mjs', import.meta.url),
    'utf8'
  );
  const effectsSource = await readFile(
    new URL('../../../client/src/features/social/useFollowingModalControllerEffects.mjs', import.meta.url),
    'utf8'
  );
  const resultActionsSource = await readFile(
    new URL('../../../client/src/features/social/useFollowingModalControllerResultActions.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/social/useFollowingModalControllerState.mjs', import.meta.url),
    'utf8'
  );
  const viewStateSource = await readFile(
    new URL('../../../client/src/features/social/useFollowingModalControllerViewState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerSource, /from '\.\/useFollowingModalControllerComposition\.mjs'/);
  assert.match(controllerSource, /from '\.\/useFollowingModalControllerState\.mjs'/);
  assert.match(controllerSource, /useFollowingModalControllerComposition\(/);
  assert.match(controllerSource, /useFollowingModalControllerState\(/);
  assert.doesNotMatch(controllerSource, /from '\.\/useFollowingModalControllerActions\.mjs'/);
  assert.doesNotMatch(controllerSource, /from '\.\/useFollowingModalControllerViewState\.mjs'/);
  assert.doesNotMatch(controllerSource, /useFollowingModalRuntimeEffects\(/);
  assert.doesNotMatch(controllerSource, /createFollowingModalSendRequestAction\(/);
  assert.doesNotMatch(controllerSource, /buildFollowingModalTabs\(/);
  assert.doesNotMatch(controllerSource, /const \[tab, setTab\] = useState\(/);

  assert.match(compositionSource, /from '\.\/useFollowingModalControllerActions\.mjs'/);
  assert.match(compositionSource, /from '\.\/useFollowingModalControllerViewState\.mjs'/);
  assert.match(compositionSource, /useFollowingModalControllerViewState\(/);
  assert.match(compositionSource, /useFollowingModalControllerActions\(/);

  assert.match(actionsSource, /function useFollowingModalControllerActions\(/);
  assert.match(actionsSource, /useFollowingModalControllerEffects\(/);
  assert.match(actionsSource, /useFollowingModalControllerResultActions\(/);
  assert.doesNotMatch(actionsSource, /useFollowingModalRuntimeEffects\(/);
  assert.doesNotMatch(actionsSource, /createFollowingModalLoadFriendsAction\(/);
  assert.doesNotMatch(actionsSource, /createFollowingModalSendRequestAction\(/);
  assert.doesNotMatch(actionsSource, /openFollowingModalPrimalProfile\(/);
  assert.match(effectsSource, /useFollowingModalRuntimeEffects\(/);
  assert.match(effectsSource, /createFollowingModalLoadFriendsAction\(/);
  assert.match(resultActionsSource, /from '\.\/useFollowingModalControllerSearchActions\.mjs'/);
  assert.match(resultActionsSource, /from '\.\/useFollowingModalControllerRequestActions\.mjs'/);
  assert.match(resultActionsSource, /from '\.\/useFollowingModalControllerInviteActions\.mjs'/);
  assert.match(resultActionsSource, /useFollowingModalControllerSearchActions\(/);
  assert.match(resultActionsSource, /useFollowingModalControllerRequestActions\(/);
  assert.match(resultActionsSource, /useFollowingModalControllerInviteActions\(/);
  assert.doesNotMatch(resultActionsSource, /createFollowingModalSendRequestAction\(/);
  assert.doesNotMatch(resultActionsSource, /openFollowingModalPrimalProfile\(/);
  assert.match(stateSource, /function useFollowingModalControllerState\(/);
  assert.match(viewStateSource, /function useFollowingModalControllerViewState\(/);
});
