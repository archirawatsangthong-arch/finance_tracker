import { useEffect } from 'react';
import { Hero } from '../../components/landing/Hero';
import { Navbar } from '../../components/landing/Navbar';
import { TutorialSection } from '../../components/landing/tutorial/TutorialSection';
import { ParticleBackground } from '../../components/three/ParticleBackground';
import { Toaster } from '../../components/ui/Toaster';
import { useSettings } from '../../store/settings';

/** หน้าแรกสาธารณะ (ไม่ต้องล็อกอิน) — แนะนำแอปแบบ tutorial ก่อนให้ผู้ใช้กดเข้าสู่ระบบเอง */
export default function Landing() {
  // หน้า Landing ใช้ธีมมืดเสมอ (คืนค่าธีมที่ผู้ใช้เลือกเมื่อออกจากหน้านี้)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dark');
    return () => {
      root.classList.toggle('dark', useSettings.getState().theme === 'dark');
    };
  }, []);

  useEffect(() => {
    document.title = 'Coinly — จัดการเงินให้ง่ายเหมือนหยอดกระปุก';
    // เปิดจากลิงก์ที่มี #section ให้เลื่อนไปตรงนั้น
    const id = window.location.hash.slice(1);
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView(), 300);
  }, []);

  return (
    <div className="relative overflow-x-clip">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-20 focus:z-[70] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white">
        ข้ามไปเนื้อหาหลัก
      </a>
      <ParticleBackground theme="dark" />
      <Navbar />
      <main id="main">
        <Hero />
        <TutorialSection />
      </main>
      <Toaster />
    </div>
  );
}
