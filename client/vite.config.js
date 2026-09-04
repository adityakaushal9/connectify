import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server on :5173 to match server CLIENT_URL + README
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
