import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { FullScreenLoader, GuestOnly, RequireAdmin, RequireAuth } from './components/auth/Guards';
import { AppLayout } from './components/layout/AppLayout';
import { SetupNotice } from './components/layout/SetupNotice';
import { supabaseConfigured } from './lib/supabase';

// แยกแต่ละหน้าเป็น chunk — โหลดเฉพาะเมื่อเข้าใช้
const Landing = lazy(() => import('./pages/landing/Landing'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Analytics = lazy(() => import('./pages/Analytics'));
const BudgetGoals = lazy(() => import('./pages/BudgetGoals'));
const Settings = lazy(() => import('./pages/Settings'));
const Account = lazy(() => import('./pages/Account'));
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const AuthCallback = lazy(() => import('./pages/auth/AuthCallback'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));

const page = (node: ReactNode) => <Suspense fallback={<FullScreenLoader />}>{node}</Suspense>;

// URL เดิมก่อนย้ายแอปไปไว้ใต้ /app — ส่งต่อให้ bookmark เก่ายังใช้ได้
const LEGACY = ['transactions', 'analytics', 'budget', 'settings', 'account'].map((p) => ({
  path: `/${p}`,
  element: <Navigate to={`/app/${p}`} replace />,
}));

const router = createBrowserRouter([
  // ---- หน้าสาธารณะ (ไม่ต้องล็อกอิน และไม่ redirect อัตโนมัติ) ----
  { path: '/', element: page(<Landing />) },
  { path: '/login', element: page(<GuestOnly><Login /></GuestOnly>) },
  { path: '/register', element: page(<GuestOnly><Register /></GuestOnly>) },
  { path: '/forgot-password', element: page(<GuestOnly><ForgotPassword /></GuestOnly>) },
  { path: '/reset-password', element: page(<ResetPassword />) },
  { path: '/auth/callback', element: page(<AuthCallback />) },
  { path: '/auth/confirm', element: page(<AuthCallback />) },

  // ---- แอปหลัก (ต้องล็อกอิน) ----
  {
    path: '/app',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'transactions', element: <Transactions /> },
      { path: 'analytics', element: <Analytics /> },
      { path: 'budget', element: <BudgetGoals /> },
      { path: 'settings', element: <Settings /> },
      { path: 'account', element: <Account /> },
      { path: '*', element: <Navigate to="/app" replace /> },
    ],
  },

  // ---- หลังบ้าน (ต้องเป็น admin) ----
  {
    path: '/admin',
    element: (
      <RequireAuth>
        {page(
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>,
        )}
      </RequireAuth>
    ),
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'users', element: <AdminUsers /> },
    ],
  },
  ...LEGACY,
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default function App() {
  if (!supabaseConfigured) return <SetupNotice />;
  return <RouterProvider router={router} />;
}
