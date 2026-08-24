import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // El proyecto vive en una carpeta sincronizada con OneDrive: el watcher
    // nativo de archivos (ReadDirectoryChangesW) se cuelga ahí y "npm run dev"
    // nunca responde. Polling evita depender de esos eventos nativos.
    watch: { usePolling: true },
  },
  test: {
    environment: 'node',
    globals: true,
  },
})
