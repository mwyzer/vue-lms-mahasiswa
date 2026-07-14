import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./app/test/setup.ts'],
    globals: true,
    include: ['app/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['app/stores/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, './app'),
      '@': resolve(__dirname, './app'),
      '#app': resolve(__dirname, './app'),
    },
  },
})
