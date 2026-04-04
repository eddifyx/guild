export function escapeAddonPreviewHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function openAddonImagePreviewWindow({
  url = '',
  name = '',
  openWindowFn = (...args) => window.open(...args),
} = {}) {
  const previewWindow = openWindowFn('', '_blank');
  if (!previewWindow) {
    return false;
  }

  previewWindow.opener = null;
  const safeTitle = escapeAddonPreviewHtml(name || 'Image Preview');
  const safeUrl = escapeAddonPreviewHtml(url);

  previewWindow.document.open();
  previewWindow.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #020502;
        color: #d7ffd7;
        overflow: hidden;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      img {
        max-width: 100vw;
        max-height: 100vh;
        object-fit: contain;
      }
    </style>
  </head>
  <body>
    <img src="${safeUrl}" alt="${safeTitle}" />
  </body>
</html>`);
  previewWindow.document.close();

  return true;
}

export function triggerAddonDownload({
  fileName = '',
  url = '',
  createAnchorFn = () => document.createElement('a'),
} = {}) {
  const anchor = createAnchorFn();
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  return anchor;
}
