import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const monorepoRoot = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, monorepoRoot, '')

  return {
    envDir: monorepoRoot,
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: env.FRONTEND_HOST || '0.0.0.0',
      port: Number(env.FRONTEND_PORT || 5173),
    },
    preview: {
      host: env.FRONTEND_HOST || '0.0.0.0',
      port: Number(env.FRONTEND_PORT || 5173),
    },
  }
})
