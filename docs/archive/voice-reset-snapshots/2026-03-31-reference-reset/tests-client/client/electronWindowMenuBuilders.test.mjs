import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  buildDockMenuTemplate,
  buildMacApplicationMenuTemplate,
  buildSystemContextMenuTemplate,
  buildTrayMenuTemplate,
  buildWindowContextMenuTemplate,
  buildWindowsJumpListTasks,
} = require('../../../client/electron/electronWindowMenuBuilders.js');

test('electron window menu builders expose canonical menu, tray, and jump-list contracts', () => {
  assert.deepEqual(
    buildWindowContextMenuTemplate({ isEditable: true }).map((item) => item.label || item.role || item.type),
    ['Copy', 'Select All', 'separator', 'Paste']
  );
  assert.equal(buildSystemContextMenuTemplate({
    appDisplayName: 'Guild',
    appVersion: '1.2.3',
    isMaximized: false,
    onClose() {},
    onMinimize() {},
    onShowAbout() {},
    onToggleMaximize() {},
  })[0].label, 'About Guild v1.2.3');
  assert.equal(buildMacApplicationMenuTemplate({
    app: { name: 'Guild', showAboutPanel() {} },
    appDisplayName: 'Guild',
  })[0].label, 'Guild');
  assert.equal(buildDockMenuTemplate({
    appDisplayName: 'Guild',
    appVersion: '1.2.3',
    showAboutPanel() {},
  })[0].label, 'About Guild v1.2.3');
  assert.equal(buildTrayMenuTemplate({
    appDisplayName: 'Guild',
    appVersion: '1.2.3',
    focusMainWindow() {},
    quitApp() {},
    showAboutDialog() {},
  })[2].label, 'Show');
  assert.equal(buildWindowsJumpListTasks({
    appDisplayName: 'Guild',
    appVersion: '1.2.3',
    processPath: '/tmp/Guild.exe',
    profileId: 'staging',
  })[0].arguments, '--profile=staging --show-about');
});
