import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Windows kann auf ::1:3000 EACCES liefern (IPv6 localhost). Wir binden daher explizit an IPv4
    // und nutzen einen Standard-Vite-Port, der meist frei ist.
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})
