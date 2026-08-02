import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { LayoutDashboard, ShoppingCart, Package, LogOut, QrCode, Users } from 'lucide-react';
import { cn } from '../lib/utils';

export function Layout() {
  const { user, role, logout } = useAuth();
  const location = useLocation();

  if (!user) {
    return null; // Will be handled by router
  }

  const navItems = [
    { name: 'Satış', path: '/', icon: ShoppingCart, allowedRoles: ['admin', 'staff'] },
    { name: 'Ürünler', path: '/products', icon: Package, allowedRoles: ['admin', 'staff'] },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, allowedRoles: ['admin'] },
    { name: 'Kullanıcılar', path: '/users', icon: Users, allowedRoles: ['admin'] },
    { name: 'QR Basım', path: '/qr', icon: QrCode, allowedRoles: ['admin', 'staff'] },
  ];

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900 overflow-hidden">
      {/* Sidebar for Desktop / Tablet */}
      <aside className="w-24 md:w-64 bg-white border-r border-gray-200 flex flex-col justify-between">
        <div className="flex flex-col h-full">
          <div className="p-4 md:p-6 border-b border-gray-100 bg-blue-600">
            <h1 className="text-xl md:text-sm font-black tracking-tight text-white hidden md:block leading-tight">
              DEMİRKIRANLAR ALÜMİNYUM
            </h1>
            <p className="text-blue-100 text-[10px] hidden md:block mt-1 uppercase font-bold tracking-wider leading-tight">Plastik Demir Doğrama<br/>Yapı Malz. İnş. San. Tic. Ltd. Şti.</p>
            <h1 className="text-xl font-bold text-center text-white md:hidden">DA</h1>
          </div>
          
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navItems.filter(item => item.allowedRoles.includes(role || '')).map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center justify-center md:justify-start p-4 rounded-xl transition-colors gap-3",
                    isActive 
                      ? "bg-blue-50 text-blue-700 font-semibold" 
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <Icon className="w-6 h-6 shrink-0" />
                  <span className="hidden md:inline">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-center md:justify-start">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-3 hidden md:flex">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-lg border-2 border-white">
                {user?.displayName ? user.displayName[0].toUpperCase() : 'U'}
              </div>
              <div className="truncate">
                <p className="text-sm font-bold truncate">{user?.displayName || 'Kullanıcı'}</p>
                <p className="text-xs text-gray-500 capitalize">{role === 'admin' ? 'Yönetici' : 'Satış Personeli'}</p>
              </div>
            </div>
            <button 
              onClick={logout}
              title="Çıkış Yap"
              className="flex items-center justify-center text-red-600 hover:bg-red-50 p-2 rounded-xl transition-colors md:ml-auto"
            >
              <LogOut className="w-6 h-6 shrink-0" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center space-x-4"></div>
          <div className="flex items-center space-x-6">
            <div className="text-right hidden md:block">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Hoş Geldiniz</p>
              <p className="text-sm font-black text-gray-900">{user?.displayName}</p>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
