import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    fs: { strict: false },
    port: 5173,
    proxy: {
      '/php-api': {
        target: 'https://myra.livoras.online',
        changeOrigin: true
      },
      '/myra': {
        target: 'https://myra.livoras.online',
        changeOrigin: true
      },
      '/login.php': {
        target: 'https://myra.livoras.online',
        changeOrigin: true
      },
      '/signup.php': {
        target: 'https://myra.livoras.online',
        changeOrigin: true
      },
      '/me.php': {
        target: 'https://myra.livoras.online',
        changeOrigin: true
      },
      '/logout.php': {
        target: 'https://myra.livoras.online',
        changeOrigin: true
      },
      '/health.php': {
        target: 'https://myra.livoras.online',
        changeOrigin: true
      },
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  }
});
