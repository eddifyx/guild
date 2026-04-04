import { useCallback, useEffect, useRef, useState } from 'react';

import { getFileUrl } from '../../api';
import { decryptAttachment } from '../../crypto/attachmentEncryption';
import {
  buildFilePreviewAttachmentModel,
  buildFilePreviewLayoutStyles,
} from './filePreviewModel.mjs';

export function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function openImagePreviewWindow(url, name) {
  const previewWindow = window.open('', '_blank');
  if (!previewWindow) return;

  previewWindow.opener = null;
  const safeTitle = escapeHtml(name || 'Image Preview');
  const safeUrl = escapeHtml(url);

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
        user-select: none;
        -webkit-user-drag: none;
      }
      .hint {
        position: fixed;
        right: 14px;
        bottom: 12px;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(5, 16, 5, 0.86);
        border: 1px solid rgba(64, 255, 64, 0.14);
        color: rgba(215, 255, 215, 0.72);
        font-size: 11px;
        letter-spacing: 0.01em;
      }
    </style>
  </head>
  <body>
    <img src="${safeUrl}" alt="${safeTitle}" />
    <div class="hint">Esc, Cmd+W, or Ctrl+W to close</div>
    <script>
      window.addEventListener('keydown', (event) => {
        const closeRequested = event.key === 'Escape'
          || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'w');
        if (!closeRequested) return;
        event.preventDefault();
        window.close();
      });
    </script>
  </body>
</html>`);
  previewWindow.document.close();
}

async function copyImageToClipboard(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  const pngBlob = blob.type === 'image/png' ? blob : await new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
    };

    const resolveOnce = (value) => {
      cleanup();
      resolve(value);
    };

    const rejectOnce = (error) => {
      cleanup();
      reject(error);
    };

    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const context = canvas.getContext('2d');
        if (!context) {
          rejectOnce(new Error('Failed to copy image'));
          return;
        }
        context.drawImage(img, 0, 0);
        canvas.toBlob((nextBlob) => {
          if (nextBlob) {
            resolveOnce(nextBlob);
            return;
          }
          rejectOnce(new Error('Failed to copy image'));
        }, 'image/png');
      } catch (error) {
        rejectOnce(error);
      }
    };
    img.onerror = () => {
      rejectOnce(new Error('Failed to load image'));
    };
    img.src = objectUrl;
  });

  if (!pngBlob) {
    throw new Error('Failed to copy image');
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
}

export function useFilePreviewController({ attachment, compact = false } = {}) {
  const previewModel = buildFilePreviewAttachmentModel(attachment);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [decryptedUrl, setDecryptedUrl] = useState(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState(null);
  const [stickyLocalPreviewUrl, setStickyLocalPreviewUrl] = useState(previewModel.localPreviewUrl);
  const decryptedUrlRef = useRef(null);
  const lastAttachmentKeyRef = useRef(null);

  const { previewBoxStyle, mediaStyle } = buildFilePreviewLayoutStyles(compact);
  const url = getFileUrl(previewModel.serverUrl);
  const displayUrl = previewModel.isEncrypted
    ? (stickyLocalPreviewUrl || decryptedUrl)
    : url;

  useEffect(() => () => {
    if (decryptedUrlRef.current) {
      URL.revokeObjectURL(decryptedUrlRef.current);
    }
  }, []);

  useEffect(() => {
    if (previewModel.localPreviewUrl) {
      setStickyLocalPreviewUrl(previewModel.localPreviewUrl);
    }
  }, [previewModel.localPreviewUrl]);

  useEffect(() => {
    if (lastAttachmentKeyRef.current === previewModel.attachmentKey) return;
    lastAttachmentKeyRef.current = previewModel.attachmentKey;

    if (decryptedUrlRef.current) {
      URL.revokeObjectURL(decryptedUrlRef.current);
      decryptedUrlRef.current = null;
    }

    setDecryptedUrl(null);
    setDecrypting(false);
    setDecryptError(null);
    setStickyLocalPreviewUrl(previewModel.localPreviewUrl || null);
  }, [previewModel.attachmentKey, previewModel.localPreviewUrl]);

  const handleDecrypt = useCallback(async () => {
    if (decryptedUrl || decrypting || !previewModel.isEncrypted) return;
    setDecrypting(true);
    setDecryptError(null);
    try {
      const blob = await decryptAttachment(url, previewModel.encKey, previewModel.encDigest, previewModel.type);
      const objUrl = URL.createObjectURL(blob);
      if (decryptedUrlRef.current) {
        URL.revokeObjectURL(decryptedUrlRef.current);
      }
      decryptedUrlRef.current = objUrl;
      setDecryptedUrl(objUrl);
    } catch (err) {
      console.error('Attachment decryption failed:', err);
      setDecryptError(err.message);
    }
    setDecrypting(false);
  }, [decryptedUrl, decrypting, previewModel.encDigest, previewModel.encKey, previewModel.isEncrypted, previewModel.type, url]);

  useEffect(() => {
    if (previewModel.isEncrypted && previewModel.isInlineMedia && !stickyLocalPreviewUrl && !decryptedUrl && !decrypting && !decryptError) {
      handleDecrypt();
    }
  }, [
    decryptError,
    decryptedUrl,
    decrypting,
    handleDecrypt,
    previewModel.isEncrypted,
    previewModel.isInlineMedia,
    stickyLocalPreviewUrl,
  ]);

  const handleContextMenu = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setCtxMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setCtxMenu(null);
  }, []);

  const copyImage = useCallback(async () => {
    try {
      await copyImageToClipboard(displayUrl || url);
    } catch (err) {
      console.error('Failed to copy image:', err);
    }
    closeContextMenu();
  }, [closeContextMenu, displayUrl, url]);

  const openInBrowser = useCallback(() => {
    openImagePreviewWindow(displayUrl || url, previewModel.name);
    closeContextMenu();
  }, [closeContextMenu, displayUrl, previewModel.name, url]);

  return {
    ...previewModel,
    url,
    displayUrl,
    previewBoxStyle,
    mediaStyle,
    ctxMenu,
    decryptError,
    decrypting,
    handleDecrypt,
    handleContextMenu,
    closeContextMenu,
    copyImage,
    openInBrowser,
  };
}
