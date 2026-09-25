import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  optimizeDeps: {
    noDiscovery: true,
    include: ['react', 'react-dom/client', 'three', '@react-three/fiber', '@react-three/drei', 'leaflet', 'recharts', 'zustand', 'lucide-react'],
  },
});
