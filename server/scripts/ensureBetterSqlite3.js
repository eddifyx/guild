const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const serverDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverDir, '..');
const sourceDir = path.join(repoRoot, 'node_modules', 'better-sqlite3');
const localModulesDir = path.join(serverDir, 'node_modules');
const localDir = path.join(localModulesDir, 'better-sqlite3');
const markerPath = path.join(localDir, '.native-abi');
const builtAddonPath = path.join(localDir, 'build', 'Release', 'better_sqlite3.node');
const currentAbi = process.versions.modules || '';

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function ensureLocalCopy() {
  if (fs.existsSync(localDir)) {
    return;
  }

  if (!fs.existsSync(sourceDir)) {
    throw new Error('Root better-sqlite3 install was not found at ' + sourceDir);
  }

  fs.mkdirSync(localModulesDir, { recursive: true });
  copyDirSync(sourceDir, localDir);
}

function needsRebuild() {
  if (!fs.existsSync(builtAddonPath)) {
    return true;
  }

  if (!fs.existsSync(markerPath)) {
    return true;
  }

  const recordedAbi = fs.readFileSync(markerPath, 'utf8').trim();
  return recordedAbi !== currentAbi;
}

function rebuildLocalAddon() {
  const command = process.platform === 'win32'
    ? {
        bin: 'powershell.exe',
        args: [
          '-Command',
          `& '${path.join(path.dirname(process.execPath), 'npm.cmd')}' rebuild better-sqlite3 --prefix '${serverDir}'`,
        ],
      }
    : {
        bin: 'npm',
        args: ['rebuild', 'better-sqlite3', '--prefix', serverDir],
      };

  const result = spawnSync(command.bin, command.args, { cwd: repoRoot, stdio: 'inherit' });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error('better-sqlite3 rebuild failed with exit code ' + result.status);
  }

  fs.writeFileSync(markerPath, currentAbi + '\n');
}

function main() {
  ensureLocalCopy();

  if (needsRebuild()) {
    console.log('[native] Rebuilding server-local better-sqlite3 for ABI', currentAbi);
    rebuildLocalAddon();
  }
}

main();
