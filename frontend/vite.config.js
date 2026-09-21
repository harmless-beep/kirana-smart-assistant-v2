import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const API_URL = process.env.VITE_API_URL || ''
const REPO_NAME = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'kirana-smart-assistant'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? `/${REPO_NAME}/` : '/',
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
  },
  // When deploying frontend separately (GitHub Pages) with a remote
  // backend (Fly.io), rewrite /ai-api calls to go through the backend
  // so CORS is handled server-side.
  ...(API_URL ? {
    build: {
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
  } : {}),
})
