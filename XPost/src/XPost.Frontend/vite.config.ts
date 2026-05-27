import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import os from 'os'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  cacheDir: path.join(os.tmpdir(), "vite-cache-xpost"),
  server: {
    // host: 'local.xpost.com',
    host: 'localhost',
    port: 5173,
    strictPort: true,
  }
})
