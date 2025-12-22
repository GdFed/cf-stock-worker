import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';

export default defineConfig(({ mode }) => {
  const proxyTarget = 'https://push2his.eastmoney.com';

  return {
    plugins: [vue(), cssInjectedByJs()],
    define: {
      // For production build, prepend the target. For dev, it's an empty string and the proxy is used.
      'process.env.VITE_API_TARGET': JSON.stringify(mode === 'production' ? proxyTarget : '')
    },
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          // rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.js'),
        name: 'CfStockWorkerComponents',
        fileName: (format) => `components.${format}.js`,
      },
      rollupOptions: {
        external: ['vue'],
        output: {
          globals: {
            vue: 'Vue',
          },
        },
      },
    },
  }
});
