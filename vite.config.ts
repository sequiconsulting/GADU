import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: [
          'localhost',
          '127.0.0.1',
          '0.0.0.0',
          'devserver-main--gadu.netlify.app',
          '.netlify.app',
          '.local'
        ]
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
      ,
      build: {
        // Improve chunking to keep large vendor libraries in separate files
        rollupOptions: {
          output: {
            manualChunks(id: string) {
              if (id.includes('node_modules')) {
                if (id.includes('react') || id.includes('react-dom')) return 'react-vendor';
                if (id.includes('firebase')) return 'firebase';
                if (id.includes('lucide-react')) return 'icons';
                if (id.includes('@faker-js') || id.includes('faker')) return 'faker';
                return 'vendor';
              }
            }
          }
        },
        chunkSizeWarningLimit: 600
      }
    };
});
