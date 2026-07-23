/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { escapeKnownReactUrlConstantsPlugin } from './build/escapeUrlProtocols'

export default defineConfig({
  plugins: [react(), escapeKnownReactUrlConstantsPlugin()],
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
