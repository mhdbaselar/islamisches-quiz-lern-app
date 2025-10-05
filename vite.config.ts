import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const terserOptions = {
  compress: {
    passes: 2,
    pure_funcs: ['console.debug'],
  },
} as Record<string, unknown>

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
  ],
  build: {
    minify: 'terser',
    terserOptions,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/echarts')) {
            if (id.includes('/renderers/')) return 'echarts-renderers'
            if (id.includes('/charts/')) return 'echarts-charts'
            if (id.includes('/components/')) return 'echarts-components'
            return 'echarts-core'
          }
          if (id.includes('node_modules/vue-echarts')) {
            return 'vue-echarts'
          }
          if (id.includes('node_modules/vue-router')) {
            return 'vue-router'
          }
          if (id.includes('node_modules/vue-i18n')) {
            return 'vue-i18n'
          }
          if (id.includes('node_modules/pinia')) {
            return 'pinia'
          }
          if (id.includes('node_modules/vue')) {
            return 'vue'
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
