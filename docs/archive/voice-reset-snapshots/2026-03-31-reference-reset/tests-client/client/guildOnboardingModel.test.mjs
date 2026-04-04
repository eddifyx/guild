import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGuildDiscoverCardState,
  buildGuildJoinConfirmationState,
  buildGuildMemberCountLabel,
  createGuildOnboardingUpdateAction,
} from '../../../client/src/features/guild/guildOnboardingModel.mjs';

test('guild onboarding model derives stable member labels and confirmation state', () => {
  assert.equal(buildGuildMemberCountLabel(1), '1 member');
  assert.equal(buildGuildMemberCountLabel(2), '2 members');

  assert.deepEqual(buildGuildDiscoverCardState({ name: 'Byzantine', memberCount: 2 }), {
    initial: 'B',
    memberLabel: '2 members · Public',
  });

  assert.deepEqual(buildGuildJoinConfirmationState({ name: 'Byzantine', memberCount: 1 }), {
    initial: 'B',
    title: 'Join Byzantine?',
    description: '1 member · Public guild',
  });
});

test('guild onboarding model opens the update overlay immediately when update info is already cached', async () => {
  const calls = [];
  const handleVersionClick = createGuildOnboardingUpdateAction({
    getUpdateAvailableFn: () => true,
    getLatestVersionInfoFn: () => ({ hasUpdate: true, latestVersion: '1.0.99' }),
    getAppVersionFn: () => '1.0.98',
    checkLatestVersionFn: async () => {
      throw new Error('should not refetch');
    },
    setLatestVersionInfoFn: () => calls.push('setLatestVersionInfo'),
    setUpdateAvailableFn: () => calls.push('setUpdateAvailable'),
    setShowUpdateOverlayFn: (value) => calls.push(['setShowUpdateOverlay', value]),
    setVersionToastFn: (value) => calls.push(['setVersionToast', value]),
  });

  const result = await handleVersionClick();

  assert.equal(result.hasUpdate, true);
  assert.equal(result.fromCache, true);
  assert.deepEqual(calls, [['setShowUpdateOverlay', true]]);
});

test('guild onboarding model shows the up-to-date toast when no update is available', async () => {
  const calls = [];
  let timeoutCallback = null;
  const handleVersionClick = createGuildOnboardingUpdateAction({
    getUpdateAvailableFn: () => false,
    getLatestVersionInfoFn: () => null,
    getAppVersionFn: () => '1.0.70',
    checkLatestVersionFn: async () => ({ hasUpdate: false }),
    setLatestVersionInfoFn: (value) => calls.push(['setLatestVersionInfo', value]),
    setUpdateAvailableFn: (value) => calls.push(['setUpdateAvailable', value]),
    setShowUpdateOverlayFn: (value) => calls.push(['setShowUpdateOverlay', value]),
    setVersionToastFn: (value) => calls.push(['setVersionToast', value]),
    setTimeoutFn: (callback, delayMs) => {
      timeoutCallback = callback;
      calls.push(['setTimeout', delayMs]);
    },
  });

  const result = await handleVersionClick();
  timeoutCallback?.();

  assert.equal(result.hasUpdate, false);
  assert.deepEqual(calls, [
    ['setLatestVersionInfo', { hasUpdate: false }],
    ['setVersionToast', "You're up to date (v1.0.70)"],
    ['setTimeout', 3000],
    ['setVersionToast', null],
  ]);
});
