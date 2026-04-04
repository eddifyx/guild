const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const here = __dirname;

test('bundle route controller delegates upload, read, and maintenance handlers to dedicated modules', async () => {
  const flowSource = await readFile(
    path.join(here, '../../../server/src/domain/keys/bundleRouteControllerFlow.js'),
    'utf8'
  );
  const uploadSource = await readFile(
    path.join(here, '../../../server/src/domain/keys/bundleRouteControllerUploadFlow.js'),
    'utf8'
  );
  const readSource = await readFile(
    path.join(here, '../../../server/src/domain/keys/bundleRouteControllerReadFlow.js'),
    'utf8'
  );
  const maintenanceSource = await readFile(
    path.join(here, '../../../server/src/domain/keys/bundleRouteControllerMaintenanceFlow.js'),
    'utf8'
  );

  assert.match(flowSource, /require\('\.\/bundleRouteControllerUploadFlow'\)/);
  assert.match(flowSource, /require\('\.\/bundleRouteControllerReadFlow'\)/);
  assert.match(flowSource, /require\('\.\/bundleRouteControllerMaintenanceFlow'\)/);
  assert.match(uploadSource, /function handleUploadBundle/);
  assert.match(readSource, /function handleDeviceBundle/);
  assert.match(maintenanceSource, /function handleReplenishOneTime/);
});
