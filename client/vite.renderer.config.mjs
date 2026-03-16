import { defineConfig } from 'vite';
import { createRequire } from 'node:module';
import react from '@vitejs/plugin-react';

const require = createRequire(import.meta.url);
const { pluginExposeRenderer } = require('@electron-forge/plugin-vite/dist/config/vite.base.config');

function getRendererPort() {
  const rawPort = process.env.BYZANTINE_RENDERER_PORT;
  if (!rawPort) return undefined;

  const parsed = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid BYZANTINE_RENDERER_PORT: ${rawPort}`);
  }

  return parsed;
}

export default defineConfig(() => {
  const rendererPort = getRendererPort();

  return {
    plugins: [pluginExposeRenderer('main_window'), react()],
    server: rendererPort
      ? {
          port: rendererPort,
          strictPort: true,
        }
      : undefined,
  };
});
