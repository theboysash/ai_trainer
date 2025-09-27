import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        // You can add more entry points here for different workout types
      }
    }
  },
  server: {
    port: 5173,
    host: true // Allows external connections for mobile testing
  }
});