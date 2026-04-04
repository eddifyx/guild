import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getBuildConfig, getBuildDefine, pluginHotRestart } = require('@electron-forge/plugin-vite/dist/config/vite.base.config');
const CLIENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ELECTRON_RUNTIME_DIR = path.join(CLIENT_DIR, 'electron');
const ELECTRON_RUNTIME_EXCLUDES = new Set(['main.js', 'preload.js', '.DS_Store']);

function copyElectronRuntimeFiles(outputDir) {
  if (!outputDir || !fs.existsSync(ELECTRON_RUNTIME_DIR)) return;

  for (const entryName of fs.readdirSync(ELECTRON_RUNTIME_DIR)) {
    if (ELECTRON_RUNTIME_EXCLUDES.has(entryName)) continue;

    fs.cpSync(
      path.join(ELECTRON_RUNTIME_DIR, entryName),
      path.join(outputDir, entryName),
      {
        force: true,
        recursive: true,
      }
    );
  }
}

function copyElectronRuntimePlugin() {
  return {
    name: 'guild-copy-electron-runtime-files',
    writeBundle(outputOptions) {
      const outputDir = outputOptions?.dir || (outputOptions?.file ? path.dirname(outputOptions.file) : null);
      copyElectronRuntimeFiles(outputDir);
    },
  };
}

export default defineConfig((env) => {
  const define = getBuildDefine(env);
  const config = getBuildConfig(env);
  return mergeConfig(config, {
    define,
    plugins: [
      copyElectronRuntimePlugin(),
      pluginHotRestart('restart'),
    ],
    build: {
      rollupOptions: {
        external: ['@signalapp/libsignal-client', 'better-sqlite3'],
      },
    },
  });
});
