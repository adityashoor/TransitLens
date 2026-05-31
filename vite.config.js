import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    TanStackRouterVite({ routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts' }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Proxy CKAN requests in dev to bypass CORS
      '/api/ckan': {
        target: 'https://ckan0.cf.opendata.inter.prod-toronto.ca',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ckan/, ''),
        secure: true,
      },
      '/api/gtfsrt': {
        target: 'https://bustime.ttc.ca',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gtfsrt/, '/gtfsrt'),
        secure: true,
      },
    },
  },
})
