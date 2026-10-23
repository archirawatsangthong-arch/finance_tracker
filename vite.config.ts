import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Coinly — บันทึกรายรับรายจ่าย',
        short_name: 'Coinly',
        description: 'บันทึกรายรับรายจ่ายส่วนตัว ใช้งานออฟไลน์ได้',
        lang: 'th',
        theme_color: '#0A0A0F',
        background_color: '#0A0A0F',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        // ไม่มี runtimeCaching: คำขอไปยัง Supabase (คนละ origin) ไม่ถูกแคช ข้อมูลส่วนตัวมาจาก server เสมอ
      },
    }),
  ],
  build: {
    // three.js chunk ใหญ่แต่ถูก lazy load เฉพาะตอนแสดง 3D
    chunkSizeWarningLimit: 1100,
    rolldownOptions: {
      output: {
        // แยก chunk ไลบรารีหนัก ๆ ให้โหลดเฉพาะตอนใช้ (priority สูงกว่าถูกจับก่อน)
        codeSplitting: {
          groups: [
            // bloom และ GSAP ใช้เฉพาะหน้า Landing — แอปหลักไม่ต้องโหลด
            // (group ดึง dependency ตามไปด้วย จึงต้องไม่ให้ @react-three/postprocessing ตกไปอยู่ group three)
            { name: 'fx', test: /node_modules[\/](@react-three[\/]postprocessing|postprocessing|n8ao)[\/]/, priority: 40, includeDependenciesRecursively: false },
            { name: 'three', test: (id) => /node_modules[\/](three|@react-three|three-stdlib|three-mesh-bvh|troika|maath|meshline|camera-controls)/.test(id) && !/postprocessing/.test(id), priority: 30 },
            { name: 'gsap', test: /node_modules[\/]gsap/, priority: 20 },
            { name: 'charts', test: /node_modules[\/](recharts|d3-|victory-vendor)/, priority: 10 },
          ],
        },
      },
    },
  },
});
