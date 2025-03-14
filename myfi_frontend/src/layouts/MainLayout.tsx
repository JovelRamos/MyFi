// src/layouts/MainLayout.tsx
import Header from '../components/Header';
import { Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';

export default function MainLayout() {
  return (
    <div className="min-w-screen bg-zinc-900">
      <Header />
      
      <main className="max-w-[3840px] min-w-[1920px] mx-auto py-12 px-120">
        <Outlet />
      </main>
      
      <ToastContainer position="bottom-right" />
    </div>
  );
}
