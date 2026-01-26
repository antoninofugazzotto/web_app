import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// IMPORTANTE: Sostituisci 'web_app' con il nome del TUO repository GitHub
export default defineConfig({
  plugins: [react()],
  base: '/web_app/', // ← CAMBIA QUESTO con il nome del tuo repo!
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})