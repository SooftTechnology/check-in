import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Para GitHub Pages: usar el nombre del repositorio como base path
    // Si GITHUB_REPOSITORY está definido, extraer el nombre del repo
    let base = '/';
    if (process.env.GITHUB_ACTIONS && process.env.GITHUB_REPOSITORY) {
      const repoName = process.env.GITHUB_REPOSITORY.split('/')[1];
      // Solo agregar base path si no es un repositorio de usuario (usuario.github.io)
      if (!repoName.endsWith('.github.io')) {
        base = `/${repoName}/`;
      }
    } else if (process.env.VITE_BASE_PATH) {
      // Permitir override manual para testing local
      base = process.env.VITE_BASE_PATH;
    }
    
    // Log para debugging en CI
    if (process.env.GITHUB_ACTIONS) {
      console.log(`[Vite Config] GITHUB_REPOSITORY: ${process.env.GITHUB_REPOSITORY}`);
      console.log(`[Vite Config] Base path: ${base}`);
    }
    
    return {
      base,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
