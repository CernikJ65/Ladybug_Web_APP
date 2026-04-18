import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    cssCodeSplit: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('/three/') || id.includes('\\three\\')) return 'three';
          if (id.includes('react-icons')) return 'icons';
          if (
            id.includes('/i18next') ||
            id.includes('\\i18next') ||
            id.includes('react-i18next')
          ) return 'i18n';
          if (id.includes('react-router')) return 'router';
          if (
            id.includes('/react/') || id.includes('\\react\\') ||
            id.includes('/react-dom/') || id.includes('\\react-dom\\') ||
            id.includes('/scheduler/') || id.includes('\\scheduler\\')
          ) return 'react-vendor';

          return 'vendor';
        },
      },
    },
  },
});
