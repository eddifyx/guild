const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createRouteErrorHandler,
  createStatementRunner,
  sendRouteResult,
} = require('../../../server/src/domain/keys/bundleRouteControllerRuntime');

test('bundle route controller runtime prepares statements and runs them with the original arguments', () => {
  const calls = [];
  const runner = createStatementRunner({
    prepare(sql) {
      calls.push(['prepare', sql]);
      return {
        run(...args) {
          calls.push(['run', ...args]);
          return { changes: 1 };
        },
      };
    },
  }, 'DELETE FROM demo WHERE id = ?', 'deleteDemo');

  assert.deepEqual(runner(7, 'user-1'), { changes: 1 });
  assert.deepEqual(calls, [
    ['prepare', 'DELETE FROM demo WHERE id = ?'],
    ['run', 7, 'user-1'],
  ]);
});

test('bundle route controller runtime returns the canonical unavailable error when no db is present', () => {
  const runner = createStatementRunner(null, 'DELETE FROM demo WHERE id = ?', 'deleteDemo');

  assert.throws(() => runner(7), /deleteDemo is unavailable/);
});

test('bundle route controller runtime wraps route errors into the canonical 500 response', async () => {
  const errors = [];
  const originalConsoleError = console.error;
  console.error = (...args) => errors.push(args);

  try {
    const handler = createRouteErrorHandler('Error handling demo:', 'Failed to handle demo', () => {
      throw new Error('boom');
    });
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return payload;
      },
    };

    assert.deepEqual(await handler({} , res), { error: 'Failed to handle demo' });
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'Failed to handle demo' });
    assert.equal(errors.length, 1);
    assert.equal(errors[0][0], 'Error handling demo:');
    assert.equal(errors[0][1].message, 'boom');
  } finally {
    console.error = originalConsoleError;
  }
});

test('bundle route controller runtime sends ok and error route results without reshaping the payload contract', () => {
  const okRes = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return body;
    },
  };
  const errorRes = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return body;
    },
  };

  assert.deepEqual(sendRouteResult(okRes, { ok: true, body: { success: true } }), { success: true });
  assert.equal(okRes.statusCode, 200);
  assert.deepEqual(okRes.payload, { success: true });

  assert.deepEqual(sendRouteResult(errorRes, { ok: false, status: 404, error: 'missing' }), { error: 'missing' });
  assert.equal(errorRes.statusCode, 404);
  assert.deepEqual(errorRes.payload, { error: 'missing' });
});
