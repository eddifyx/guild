import test from 'node:test';
import assert from 'node:assert/strict';

import {
  escapeAddonPreviewHtml,
  openAddonImagePreviewWindow,
  triggerAddonDownload,
} from '../../../client/src/features/addons/addonPreviewRuntime.mjs';

test('addon preview runtime escapes preview html safely', () => {
  assert.equal(
    escapeAddonPreviewHtml(`"<script>alert('x')</script>"`),
    '&quot;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&quot;'
  );
});

test('addon preview runtime writes a preview document when the popup opens', () => {
  const writes = [];
  const previewWindow = {
    opener: 'keep',
    document: {
      open: () => writes.push('open'),
      write: (value) => writes.push(value),
      close: () => writes.push('close'),
    },
  };

  const didOpen = openAddonImagePreviewWindow({
    url: 'https://cdn.example/file.png',
    name: 'preview.png',
    openWindowFn: () => previewWindow,
  });

  assert.equal(didOpen, true);
  assert.equal(previewWindow.opener, null);
  assert.equal(writes[0], 'open');
  assert.equal(writes.at(-1), 'close');
  assert.match(writes[1], /preview\.png/);
  assert.match(writes[1], /https:\/\/cdn\.example\/file\.png/);
});

test('addon preview runtime returns false when the popup is blocked and triggers downloads through anchors', () => {
  assert.equal(
    openAddonImagePreviewWindow({
      url: 'https://cdn.example/file.png',
      openWindowFn: () => null,
    }),
    false
  );

  const anchor = {
    href: '',
    download: '',
    clicked: false,
    click() {
      this.clicked = true;
    },
  };

  const returnedAnchor = triggerAddonDownload({
    fileName: 'bundle.zip',
    url: 'https://cdn.example/bundle.zip',
    createAnchorFn: () => anchor,
  });

  assert.equal(returnedAnchor, anchor);
  assert.equal(anchor.href, 'https://cdn.example/bundle.zip');
  assert.equal(anchor.download, 'bundle.zip');
  assert.equal(anchor.clicked, true);
});
