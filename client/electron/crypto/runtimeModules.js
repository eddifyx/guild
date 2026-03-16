const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function getVendorNodeModulesPath() {
  return path.join(process.resourcesPath, 'vendor', 'node_modules');
}

function getPackagedModulePath(packageName) {
  if (!process.resourcesPath) return null;
  const packagedModulePath = path.join(getVendorNodeModulesPath(), ...packageName.split('/'));
  return fs.existsSync(packagedModulePath) ? packagedModulePath : null;
}

function requireRuntimeModule(packageName) {
  const packagedModulePath = getPackagedModulePath(packageName);
  if (packagedModulePath) {
    return require(packagedModulePath);
  }

  try {
    return require(packageName);
  } catch (error) {
    if (!process.resourcesPath) {
      throw error;
    }
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
    if (!process.resourcesPath) {
      throw error;
    }
    throw error;
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
