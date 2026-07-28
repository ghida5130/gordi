import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // 소스 경로의 일관성을 위한 별칭 설정
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
