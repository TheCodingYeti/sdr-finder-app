import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/sdr-finder-app/", // <--- IMPORTANT: This MUST be '/sdr-finder-app/' (matching your GitHub repo name)
})