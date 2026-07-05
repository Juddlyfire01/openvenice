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
      // Serverless OAuth endpoints (api/x/oauth/*, api/x/proxy/*) don't run under
      // plain `vite`. Run them with `vercel dev` (default :3000) and start Vite
      // with VITE_API_TARGET=http://localhost:3000 so /api forwards there. When
      // the var is unset this proxy entry is inert and /api simply 404s in dev.
      ...(process.env.VITE_API_TARGET
        ? {
            '/api': {
              target: process.env.VITE_API_TARGET,
              // Keep the browser Host (e.g. localhost:5173) so OAuth derives the
              // correct redirect_uri and sets cookies on the UI origin.
              changeOrigin: false,
            },
          }
        : {}),
    },
  },
})
