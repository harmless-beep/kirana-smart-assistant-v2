import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/kirana-smart-assistant/' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
      '/ai-api': {
        target: 'https://api.b.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai-api/, '/v1'),
      },
    },
  }
})
