import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { queryClient } from './lib/queryClient';
import { initAuth } from './store/auth';
import './index.css';

// ลงทะเบียน service worker (หน้าแอปเปิดได้แม้ออฟไลน์ — ข้อมูลจะซิงก์เมื่อออนไลน์)
registerSW({ immediate: true });
initAuth();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
