import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: process.env.VITE_SOCKET_URL || 'https://peer-2-peer-file-transfer-api.vercel.app',
        ws: true,
        changeOrigin: true
      }
    }
  }
})

