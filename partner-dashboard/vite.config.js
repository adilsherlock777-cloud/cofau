import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/orders/',
  server: {
    proxy: {
      '/api': {
        target: 'https://api.cofau.com',
        changeOrigin: true,
      }
    }
  }
})
