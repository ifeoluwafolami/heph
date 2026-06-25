import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_PROXY_API_TARGET || 'http://localhost:4000'

  return {
    plugins: [
      react(),
      tailwindcss(),
      babel({ presets: [reactCompilerPreset()] })
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api/v1': {
          target: proxyTarget,
          changeOrigin: true,
          secure: proxyTarget.startsWith('https://'),
        },
      },
    },
    preview: {
      proxy: {
        '/api/v1': {
          target: proxyTarget,
          changeOrigin: true,
          secure: proxyTarget.startsWith('https://'),
        },
      },
    },
  }
})
