import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest.json' assert { type: 'json' }
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), crx({ manifest })],
  resolve: {
    alias: {
      '@cf-stock-worker/components': path.resolve(__dirname, '../components/dist/components.es.js'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        stock: 'stock.html',
      },
    },
  },
})
