import { defineConfig } from 'vite';
import { createRequire } from 'node:module';
import react from '@vitejs/plugin-react';

const require = createRequire(import.meta.url);
const { pluginExposeRenderer } = require('@electron-forge/plugin-vite/dist/config/vite.base.config');

export default defineConfig((env) => ({
  plugins: [pluginExposeRenderer('main_window'), react()],
}));
