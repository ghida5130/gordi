import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const imageDemoRoot = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, imageDemoRoot, '')
  const apiPort = Number(env.IMAGE_DEMO_API_PORT || 8100)
  const apiTarget = `http://127.0.0.1:${apiPort}`

  return {
    envDir: imageDemoRoot,
    publicDir: fileURLToPath(new URL('../assets', import.meta.url)),
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: env.IMAGE_DEMO_FRONTEND_HOST || '127.0.0.1',
      port: Number(env.IMAGE_DEMO_FRONTEND_PORT || 5174),
      proxy: {
        '/api': apiTarget,
        '/demo-media': apiTarget,
        '/test-data': apiTarget,
      },
    },
    preview: {
      host: env.IMAGE_DEMO_FRONTEND_HOST || '127.0.0.1',
      port: Number(env.IMAGE_DEMO_FRONTEND_PORT || 5174),
      proxy: {
        '/api': apiTarget,
        '/demo-media': apiTarget,
        '/test-data': apiTarget,
      },
    },
  }
})
