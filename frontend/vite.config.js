import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/barangay_survey_system/app/',
  plugins: [react()],
  server: {
    proxy: {
      '^/api/firebase/': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
})
