const path = require('path');
const fs = require('fs');
const { VitePlugin } = require('@electron-forge/plugin-vite');

// Native modules that must be copied into the packaged app.
// Vite externalizes these (can't bundle .node addons), and npm workspaces
// hoists them to the monorepo root — so we copy them into the build manually.
const NATIVE_DEPS = ['@signalapp/libsignal-client', 'better-sqlite3'];
const RUNTIME_SOURCE_DIRS = ['electron/crypto'];

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

module.exports = {
  packagerConfig: {
    name: 'Byzantine',
    executableName: 'byzantine',
    icon: path.join(__dirname, 'assets', 'icon'),  // .ico/.icns auto-resolved per platform
    asar: {
      unpack: '**/*.node',  // Native .node files can't load from inside asar
    },
  },
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      // Copy native deps from monorepo root node_modules into the build
      const rootModules = path.resolve(__dirname, '..', 'node_modules');
      const buildModules = path.join(buildPath, 'node_modules');
      fs.mkdirSync(buildModules, { recursive: true });

      for (const dep of NATIVE_DEPS) {
        const src = path.join(rootModules, dep);
        const dest = path.join(buildModules, dep);
        if (fs.existsSync(src)) {
          copyDirSync(src, dest);
        }
      }

      // Runtime transitive deps:
      // libsignal-client needs: node-gyp-build (loads .node), uuid, type-fest
      // better-sqlite3 needs: bindings (loads .node), file-uri-to-path
      const transitiveDeps = ['node-gyp-build', 'uuid', 'type-fest', 'bindings', 'file-uri-to-path'];
      for (const dep of transitiveDeps) {
        const src = path.join(rootModules, dep);
        const dest = path.join(buildModules, dep);
        if (fs.existsSync(src) && !fs.existsSync(dest)) {
          copyDirSync(src, dest);
        }
      }

      // Keep raw main-process crypto helpers available at runtime.
      // Vite leaves the require() in main.js, so packaged builds need these files copied in.
      for (const relDir of RUNTIME_SOURCE_DIRS) {
        const src = path.join(__dirname, relDir);
        const dest = path.join(buildPath, relDir);
        if (fs.existsSync(src)) {
          copyDirSync(src, dest);
        }
      }
    },
    packageAfterPrune: async (_config, buildPath) => {
      // Rebuild native addons for the target Electron version
      const { rebuild } = require('@electron/rebuild');
      await rebuild({
        buildPath,
        electronVersion: require('./package.json').devDependencies.electron.replace('^', ''),
        force: true,
      });
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-dmg',
      config: {
        icon: path.join(__dirname, 'assets', 'icon.png'),
      },
    },
    { name: '@electron-forge/maker-zip', platforms: ['darwin', 'linux', 'win32'] },
    { name: '@electron-forge/maker-deb', config: {} },
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'electron/main.js',
          config: 'vite.main.config.mjs',
          target: 'main',
        },
        {
          entry: 'electron/preload.js',
          config: 'vite.preload.config.mjs',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mjs',
        },
      ],
    }),
  ],
};

