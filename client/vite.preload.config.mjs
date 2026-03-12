import { defineConfig, mergeConfig } from 'vite';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getBuildConfig, getBuildDefine, pluginHotRestart } = require('@electron-forge/plugin-vite/dist/config/vite.base.config');

export default defineConfig((env) => {
  const define = getBuildDefine(env);
  const config = getBuildConfig(env);
  return mergeConfig(config, {
    define,
    plugins: [pluginHotRestart('reload')],
  });
});
