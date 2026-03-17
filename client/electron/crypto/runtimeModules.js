const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function getVendorNodeModulesPath() {
  return path.join(process.resourcesPath, 'vendor', 'node_modules');
}

function getPackagedNodeModulesPaths() {
  const locations = [];

  if (process.resourcesPath) {
    locations.push(getVendorNodeModulesPath());
    locations.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'vendor', 'node_modules'));
  }

  return locations;
}

function getPackagedModulePath(packageName) {
  for (const nodeModulesPath of getPackagedNodeModulesPaths()) {
    const packagedModulePath = path.join(nodeModulesPath, ...packageName.split('/'));
    if (fs.existsSync(packagedModulePath)) {
      return packagedModulePath;
    }
  }

  return null;
}

function requireRuntimeModule(packageName) {
  const packagedModulePath = getPackagedModulePath(packageName);
  if (packagedModulePath) {
    return require(packagedModulePath);
  }

  try {
    return require(packageName);
  } catch (error) {
    throw error;
  }
}

function resolveRuntimePackageRoot(packageName) {
  const packagedModulePath = getPackagedModulePath(packageName);
  if (packagedModulePath) {
    return packagedModulePath;
  }

  try {
    return path.dirname(require.resolve(`${packageName}/package.json`));
  } catch (error) {
    throw error;
  }
}

async function importLibsignalModule() {
  const libsignalRoot = resolveRuntimePackageRoot('@signalapp/libsignal-client');
  const originalCwd = process.cwd();
  const entryUrl = pathToFileURL(path.join(libsignalRoot, 'dist', 'index.js')).href;

  process.chdir(libsignalRoot);
  try {
    return await import(entryUrl);
  } finally {
    process.chdir(originalCwd);
  }
}

module.exports = {
  getVendorNodeModulesPath,
  importLibsignalModule,
  requireRuntimeModule,
  resolveRuntimePackageRoot,
};
