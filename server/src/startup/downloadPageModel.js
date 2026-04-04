const {
  resolveVersionInfoForPlatform,
  buildUpdateDownloads,
} = require('./serverRuntimeModel');

function buildDownloadPageState(req, versionInfo, {
  updatesDir,
  existsSyncFn,
  resolveVersionInfoForPlatformFn = resolveVersionInfoForPlatform,
  buildUpdateDownloadsFn = buildUpdateDownloads,
} = {}) {
  const macVersionInfo = resolveVersionInfoForPlatformFn(versionInfo, 'darwin-arm64');
  const windowsVersionInfo = resolveVersionInfoForPlatformFn(versionInfo, 'win32-x64');
  const macVersion = macVersionInfo?.version || versionInfo?.version || '0.0.0';
  const windowsVersion = windowsVersionInfo?.version || versionInfo?.version || '0.0.0';
  const macDownload = buildUpdateDownloadsFn(req, macVersion, {
    updatesDir,
    existsSyncFn,
  })['darwin-arm64'];
  const windowsDownload = buildUpdateDownloadsFn(req, windowsVersion, {
    updatesDir,
    existsSyncFn,
  })['win32-x64'];

  return {
    latestVersion: [macVersion, windowsVersion].sort().slice(-1)[0] || '0.0.0',
    macVersion,
    windowsVersion,
    macDownload,
    windowsDownload,
  };
}

function buildDownloadPageHtml({
  macDownload,
  windowsDownload,
  macVersion,
  windowsVersion,
  latestVersion,
}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>/guild Downloads</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #070a07;
        --panel: rgba(10, 18, 10, 0.92);
        --panel-border: rgba(24, 88, 33, 0.55);
        --text: #e7efe7;
        --muted: #8ea392;
        --accent: #ff7a00;
        --success: #3cff68;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px;
        background:
          radial-gradient(circle at top, rgba(24, 88, 33, 0.22), transparent 45%),
          linear-gradient(180deg, #081008 0%, var(--bg) 100%);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .card {
        width: min(720px, 100%);
        padding: 32px;
        border-radius: 24px;
        border: 1px solid var(--panel-border);
        background: var(--panel);
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.36);
      }
      h1 {
        margin: 0 0 8px;
        font-size: 38px;
        line-height: 1.05;
      }
      p {
        margin: 0 0 18px;
        color: var(--muted);
        line-height: 1.5;
      }
      .version {
        color: var(--success);
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-size: 12px;
        margin-bottom: 14px;
      }
      .grid {
        display: grid;
        gap: 16px;
        margin-top: 26px;
      }
      .download {
        padding: 18px 20px;
        border-radius: 18px;
        border: 1px solid rgba(24, 88, 33, 0.65);
        background: rgba(8, 14, 8, 0.92);
      }
      .download h2 {
        margin: 0 0 6px;
        font-size: 20px;
      }
      .download p {
        margin-bottom: 14px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 18px;
        border-radius: 12px;
        border: 1px solid rgba(255, 122, 0, 0.28);
        background: rgba(255, 122, 0, 0.12);
        color: var(--accent);
        text-decoration: none;
        font-weight: 700;
      }
      .button.secondary {
        border-color: rgba(60, 255, 104, 0.24);
        background: rgba(60, 255, 104, 0.08);
        color: var(--success);
      }
      .footnote {
        margin-top: 22px;
        font-size: 13px;
      }
      .empty {
        padding: 18px 20px;
        border-radius: 18px;
        border: 1px dashed rgba(255, 122, 0, 0.28);
        background: rgba(18, 12, 5, 0.6);
        color: var(--muted);
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="version">Latest Downloads</div>
      <h1>/guild downloads</h1>
      <p>If the in-app updater stalls on extracting files, install the latest build directly from here once. After that, future updates will use the newer updater path.</p>
      <section class="grid">
        ${macDownload.installerUrl || macDownload.archiveUrl ? `
        <article class="download">
          <h2>${macDownload.label}</h2>
          <p>Recommended for Apple Silicon Macs. Current version: ${macVersion}.</p>
          <div class="actions">
            ${macDownload.installerUrl ? `<a class="button" href="${macDownload.installerUrl}">Download DMG</a>` : ''}
            ${macDownload.archiveUrl ? `<a class="button secondary" href="${macDownload.archiveUrl}">Download ZIP</a>` : ''}
          </div>
        </article>` : ''}
        ${windowsDownload.installerUrl ? `
        <article class="download">
          <h2>${windowsDownload.label}</h2>
          <p>Direct install package for Windows. Current version: ${windowsVersion}.</p>
          <div class="actions">
            <a class="button" href="${windowsDownload.installerUrl}">Download ZIP</a>
          </div>
        </article>` : ''}
        ${!macDownload.installerUrl && !macDownload.archiveUrl && !windowsDownload.installerUrl ? `
        <article class="empty">
          No release downloads have been published yet.
        </article>` : ''}
      </section>
      <p class="footnote">Install the new build over the existing app. Your account and server settings stay with the app profile on disk. Latest published version across platforms: ${latestVersion}.</p>
    </main>
  </body>
</html>`;
}

module.exports = {
  buildDownloadPageState,
  buildDownloadPageHtml,
};
