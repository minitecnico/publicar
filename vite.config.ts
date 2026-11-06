import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Em desenvolvimento, o Vite serve o front em :5173 e repassa /api para o
// `wrangler pages dev` (Functions + D1 + KV locais) rodando em :8788.
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:8788',
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 800,
  },
})
