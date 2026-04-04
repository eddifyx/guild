import test from 'node:test';
import assert from 'node:assert/strict';

import {
  uploadFileWithXhr,
  uploadFormDataWithAuth,
} from '../../../client/src/features/api/uploadRuntime.mjs';

test('upload runtime performs authenticated fetch uploads and surfaces api failures', async () => {
  const calls = [];

  const result = await uploadFormDataWithAuth({
    endpoint: '/api/upload',
    formData: { id: 'fd-1' },
    authHeaders: { Authorization: 'Bearer token' },
    serverUrl: 'https://guild.test',
    fetchFn: async (url, options) => {
      calls.push(['fetch', url, options]);
      return {
        ok: true,
        json: async () => ({ fileUrl: '/uploads/test.png' }),
      };
    },
  });

  assert.deepEqual(result, { fileUrl: '/uploads/test.png' });
  assert.deepEqual(calls, [[
    'fetch',
    'https://guild.test/api/upload',
    {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
      body: { id: 'fd-1' },
    },
  ]]);
});

test('upload runtime performs xhr uploads with progress and canonical errors', async () => {
  const events = [];

  class MockFormData {
    constructor() {
      this.entries = [];
    }
    append(key, value) {
      this.entries.push([key, value]);
    }
  }

  class MockXhr {
    constructor() {
      this.upload = {};
      this.headers = {};
    }
    open(method, url) {
      this.method = method;
      this.url = url;
    }
    setRequestHeader(key, value) {
      this.headers[key] = value;
    }
    send(formData) {
      this.formData = formData;
      this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
      this.status = 200;
      this.responseText = JSON.stringify({ ok: true });
      this.onload?.();
    }
  }

  const result = await uploadFileWithXhr({
    endpoint: '/api/assets',
    file: { name: 'asset.png' },
    description: 'Preview',
    authToken: 'secret',
    onProgress: (value) => events.push(['progress', value]),
    serverUrl: 'https://guild.test',
    failureMessage: 'Asset upload failed',
    xhrFactory: () => {
      const xhr = new MockXhr();
      events.push(['xhr', xhr]);
      return xhr;
    },
    formDataFactory: () => new MockFormData(),
  });

  const xhr = events[0][1];
  assert.deepEqual(result, { ok: true });
  assert.equal(xhr.method, 'POST');
  assert.equal(xhr.url, 'https://guild.test/api/assets');
  assert.equal(xhr.headers.Authorization, 'Bearer secret');
  assert.deepEqual(xhr.formData.entries, [
    ['file', { name: 'asset.png' }],
    ['description', 'Preview'],
  ]);
  assert.deepEqual(events.slice(1), [['progress', 50]]);
});
