import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export default defineConfig(({ mode }) => {
  const { API_PORT = '8000' } = loadEnv(mode, projectRoot, 'API_')

  return {
    root: path.resolve(projectRoot, 'frontend'),
    envDir: projectRoot,
    plugins: [react()],
    server: {
      proxy: {
        '/api': `http://localhost:${API_PORT}`,
      },
    },
  }
})
