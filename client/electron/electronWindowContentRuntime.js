const {
  buildSystemContextMenuTemplate,
  buildWindowContextMenuTemplate,
} = require('./electronWindowMenuBuilders');

function createElectronWindowContentRuntime({
  appDisplayName,
  appVersion,
  appendDebugLog,
  baseDir,
  enableNavigationGuards = true,
  mainWindowViteDevServerUrl,
  mainWindowViteName,
  Menu,
  openExternalHttpUrl,
  path,
  runtimeServerUrl,
  consoleRef = console,
  shellRuntime,
}) {
  function buildRuntimeQuery() {
    return runtimeServerUrl ? { serverUrl: runtimeServerUrl } : null;
  }

  function loadWindowContent(mainWindow, runtimeQuery) {
    if (mainWindowViteDevServerUrl) {
      const targetUrl = new URL(mainWindowViteDevServerUrl);
      if (runtimeQuery?.serverUrl) {
        targetUrl.searchParams.set('serverUrl', runtimeQuery.serverUrl);
      }
      mainWindow.loadURL(targetUrl.toString());
      mainWindow.webContents.openDevTools();
      return;
    }

    mainWindow.loadFile(
      path.join(baseDir, `../renderer/${mainWindowViteName}/index.html`),
      runtimeQuery ? { query: runtimeQuery } : undefined
    );
  }

  function bindWindowContent(mainWindow) {
    const runtimeQuery = buildRuntimeQuery();
    loadWindowContent(mainWindow, runtimeQuery);

    mainWindow.once('ready-to-show', () => {
      appendDebugLog('window', 'ready-to-show');
      try {
        mainWindow.show();
        mainWindow.focus();
      } catch (error) {
        appendDebugLog('window', `ready-to-show failed: ${error?.message || error}`);
      }
    });

    mainWindow.on('show', () => {
      appendDebugLog('window', 'show');
    });

    mainWindow.on('unresponsive', () => {
      appendDebugLog('window', 'unresponsive');
    });

    mainWindow.webContents.on('did-finish-load', () => {
      appendDebugLog('window', `did-finish-load ${mainWindow.webContents.getURL()}`);
    });

    mainWindow.webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        appendDebugLog(
          'window-load-fail',
          JSON.stringify({
            errorCode,
            errorDescription,
            validatedURL,
            isMainFrame,
          })
        );
      }
    );

    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      appendDebugLog('window-render-gone', JSON.stringify(details || {}));
    });

    mainWindow.webContents.on('before-input-event', (_event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
        mainWindow.webContents.toggleDevTools();
      }
    });

    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      const normalizedMessage = String(message || '');
      if (!normalizedMessage.includes('[ScreenShare')) {
        return;
      }
      appendDebugLog('renderer-console', `${normalizedMessage} (${sourceId || 'unknown'}:${line || 0})`);
      consoleRef.warn(`[Renderer:${level}] ${normalizedMessage} (${sourceId || 'unknown'}:${line || 0})`);
    });

    mainWindow.webContents.on('context-menu', (event, params) => {
      event.preventDefault();
      Menu.buildFromTemplate(
        buildWindowContextMenuTemplate({ isEditable: params.isEditable })
      ).popup({ window: mainWindow });
    });

    if (enableNavigationGuards) {
      mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url === 'about:blank') {
          return {
            action: 'allow',
            overrideBrowserWindowOptions: {
              autoHideMenuBar: true,
              backgroundColor: '#020502',
              webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true,
              },
            },
          };
        }

        openExternalHttpUrl(url);
        return { action: 'deny' };
      });

      mainWindow.webContents.on('will-navigate', (event, url) => {
        if (url === mainWindow.webContents.getURL()) {
          return;
        }
        event.preventDefault();
        openExternalHttpUrl(url);
      });
    }

    mainWindow.on('system-context-menu', (event, point) => {
      event.preventDefault();
      Menu.buildFromTemplate(
        buildSystemContextMenuTemplate({
          appDisplayName,
          appVersion,
          isMaximized: mainWindow.isMaximized(),
          onClose: () => mainWindow.close(),
          onMinimize: () => mainWindow.minimize(),
          onShowAbout: () => shellRuntime.showAboutDialog(),
          onToggleMaximize: () => {
            if (mainWindow.isMaximized()) mainWindow.unmaximize();
            else mainWindow.maximize();
          },
        })
      ).popup({ window: mainWindow, x: point.x, y: point.y });
    });

    return mainWindow;
  }

  return {
    bindWindowContent,
    buildRuntimeQuery,
    loadWindowContent,
  };
}

module.exports = {
  createElectronWindowContentRuntime,
};
