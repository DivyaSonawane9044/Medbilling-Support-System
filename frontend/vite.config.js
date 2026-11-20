import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Test output is rewritten while tests run; watching it crashes Vite on Windows (EBUSY)
    watch: { ignored: ['**/playwright-report*/**', '**/test-results*/**', '**/e2e-artifacts/**', '**/tests/**', '**/e2e/**', '**/*.crdownload'] },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep heavy, rarely-changing libraries in their own cacheable chunks
        manualChunks: {
          pdf: ['jspdf', 'html2canvas'],
          charts: ['recharts'],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    // Page render tests mount charts and several mocked requests; 5s is too tight on a busy machine
    testTimeout: 30000,
  },
})
