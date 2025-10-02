import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // server: {
  //   proxy: {
  //     // match /api prefix in frontend requests
  //     '/api': {
  //       target: 'http://0.0.0.0:8081', // your backend
  //       changeOrigin: true,
  //       secure: false,
  //       rewrite: (path) => path.replace(/^\/api/, ''), // remove /api before forwarding
  //     },
  //   },
  // },
})