function buildWindowContextMenuTemplate({ isEditable }) {
  const items = [
    { label: 'Copy', role: 'copy' },
    { label: 'Select All', role: 'selectAll' },
  ];

  if (isEditable) {
    items.push({ type: 'separator' }, { label: 'Paste', role: 'paste' });
  }

  return items;
}

function buildSystemContextMenuTemplate({
  appDisplayName,
  appVersion,
  isMaximized,
  onClose,
  onMinimize,
  onShowAbout,
  onToggleMaximize,
}) {
  return [
    { label: `About ${appDisplayName} v${appVersion}`, click: () => onShowAbout() },
    { type: 'separator' },
    { label: 'Minimize', click: () => onMinimize() },
    {
      label: isMaximized ? 'Restore' : 'Maximize',
      click: () => onToggleMaximize(),
    },
    { type: 'separator' },
    { label: 'Close', click: () => onClose() },
  ];
}

function buildMacApplicationMenuTemplate({ app, appDisplayName }) {
  return [
    {
      label: app.name,
      submenu: [
        { label: `About ${appDisplayName}`, click: () => app.showAboutPanel() },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: `Hide ${appDisplayName}` },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];
}

function buildDockMenuTemplate({ appDisplayName, appVersion, showAboutPanel }) {
  return [
    { label: `About ${appDisplayName} v${appVersion}`, click: () => showAboutPanel() },
  ];
}

function buildTrayMenuTemplate({
  appDisplayName,
  appVersion,
  focusMainWindow,
  quitApp,
  showAboutDialog,
}) {
  return [
    { label: `About ${appDisplayName} v${appVersion}`, click: () => showAboutDialog() },
    { type: 'separator' },
    { label: 'Show', click: () => focusMainWindow() },
    { label: 'Quit', click: () => quitApp() },
  ];
}

function buildWindowsJumpListTasks({ appDisplayName, appVersion, processPath, profileId }) {
  const aboutTaskArgs = profileId
    ? `--profile=${profileId} --show-about`
    : '--show-about';

  return [
    {
      program: processPath,
      arguments: aboutTaskArgs,
      iconPath: processPath,
      iconIndex: 0,
      title: `About ${appDisplayName} v${appVersion}`,
      description: 'Show version info',
    },
  ];
}

module.exports = {
  buildDockMenuTemplate,
  buildMacApplicationMenuTemplate,
  buildSystemContextMenuTemplate,
  buildTrayMenuTemplate,
  buildWindowContextMenuTemplate,
  buildWindowsJumpListTasks,
};
