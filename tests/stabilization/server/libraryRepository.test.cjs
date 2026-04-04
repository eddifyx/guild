const test = require('node:test');
const assert = require('node:assert/strict');

const { createLibraryRepository } = require('../../../server/src/repositories/libraryRepository');

test('library repository persists and lists asset dumps through the canonical query set', () => {
  const calls = [];
  const repository = createLibraryRepository({
    db: {
      prepare(sql) {
        return {
          run(...args) {
            calls.push({ sql, args });
            return { changes: 1 };
          },
          all(...args) {
            calls.push({ sql, args });
            return [{ id: 'asset-1' }];
          },
          get(...args) {
            calls.push({ sql, args });
            return { id: 'asset-1', uploaded_by: 'user-1' };
          },
        };
      },
    },
  });

  repository.insertAssetDump.run('asset-1', '/uploads/a.bin', 'a.bin', 'application/octet-stream', 10, null, 'user-1');
  repository.getAllAssetDumps.all();
  repository.getAssetDumpById.get('asset-1');
  repository.deleteAssetDump.run('asset-1');

  assert.deepEqual(calls.map((entry) => entry.args), [
    ['asset-1', '/uploads/a.bin', 'a.bin', 'application/octet-stream', 10, null, 'user-1'],
    [],
    ['asset-1'],
    ['asset-1'],
  ]);
});

test('library repository exposes addon and expiry cleanup persistence operations', () => {
  const calls = [];
  const repository = createLibraryRepository({
    db: {
      prepare(sql) {
        return {
          run(...args) {
            calls.push({ sql, args });
            return { changes: 1 };
          },
          all(...args) {
            calls.push({ sql, args });
            return sql.includes('FROM addons') ? [{ id: 'addon-1' }] : [{ id: 'expired-asset' }];
          },
          get(...args) {
            calls.push({ sql, args });
            return { id: 'addon-1', uploaded_by: 'user-1' };
          },
        };
      },
    },
  });

  repository.insertAddon.run('addon-1', '/uploads/addon.bin', 'addon.bin', 'application/octet-stream', 12, null, 'user-1');
  repository.getAllAddons.all();
  repository.getAddonById.get('addon-1');
  repository.getExpiredAssetDumps.all();
  repository.deleteExpiredAssetDumps.run();
  repository.deleteAddon.run('addon-1');

  assert.deepEqual(calls.map((entry) => entry.args), [
    ['addon-1', '/uploads/addon.bin', 'addon.bin', 'application/octet-stream', 12, null, 'user-1'],
    [],
    ['addon-1'],
    [],
    [],
    ['addon-1'],
  ]);
});
