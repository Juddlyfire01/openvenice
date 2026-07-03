import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/venice': {
        target: 'https://api.venice.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/venice/, ''),
      },
      '/xapi': {
        target: 'https://api.x.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/xapi/, ''),
      },
    },
  },
})
