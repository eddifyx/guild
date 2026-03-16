const path = require('path');
const { pathToFileURL } = require('url');

function getVendorNodeModulesPath() {
  return path.join(process.resourcesPath, 'vendor', 'node_modules');
}

function requireRuntimeModule(packageName) {
  try {
    return require(packageName);
  } catch (error) {
    if (!process.resourcesPath) {
      throw error;
    }

    const packagedModulePath = path.join(getVendorNodeModulesPath(), ...packageName.split('/'));
    return require(packagedModulePath);
  }
}

function resolveRuntimePackageRoot(packageName) {
  try {
    return path.dirname(require.resolve(`${packageName}/package.json`));
  } catch (error) {
    if (!process.resourcesPath) {
      throw error;
    }

    return path.join(getVendorNodeModulesPath(), ...packageName.split('/'));
  }
}

async function importLibsignalModule() {
  const libsignalRoot = resolveRuntimePackageRoot('@signalapp/libsignal-client');
  const originalCwd = process.cwd();

  process.chdir(libsignalRoot);
  try {
    const entryUrl = pathToFileURL(path.join(libsignalRoot, 'dist', 'index.js')).href;
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
