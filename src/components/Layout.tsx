import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { LayoutDashboard, ShoppingCart, Package, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';

export function Layout() {
  const { user, role, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const navItems = [
    { name: 'Satış', path: '/', icon: ShoppingCart, allowedRoles: ['admin', 'staff'] },
    { name: 'Ürünler', path: '/products', icon: Package, allowedRoles: ['admin', 'staff'] },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, allowedRoles: ['admin'] },
  ].filter(item => item.allowedRoles.includes(role || ''));

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <div className="flex h-[100dvh] bg-gray-50 font-sans text-gray-900 overflow-hidden">
      {/* ── DESKTOP SIDEBAR (md+) ── */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col justify-between shrink-0">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-100 bg-blue-600">
            <h1 className="text-sm font-black tracking-tight text-white leading-tight">
              DEMİRKIRANLAR ALÜMİNYUM
            </h1>
            <p className="text-blue-100 text-[10px] mt-1 uppercase font-bold tracking-wider leading-tight">
              Plastik Demir Doğrama<br />Yapı Malz. İnş. San. Tic. Ltd. Şti.
            </p>
          </div>
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center p-4 rounded-xl transition-colors gap-3',
                    isActive(item.path)
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-base border-2 border-white shrink-0">
                {user?.displayName ? user.displayName[0].toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{user?.displayName || 'Kullanıcı'}</p>
                <p className="text-xs text-gray-500 capitalize">
                  {role === 'admin' ? 'Yönetici' : 'Satış Personeli'}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Çıkış Yap"
              className="flex items-center justify-center text-red-600 hover:bg-red-50 p-2 rounded-xl transition-colors ml-2 shrink-0"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 h-12 bg-blue-600 shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <span className="text-white text-sm font-black tracking-tight">DEMİRKIRANLAR</span>
          <button
            onClick={logout}
            className="text-white/80 hover:text-white p-1.5 rounded-lg"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        {/* Desktop top bar */}
        <header className="hidden md:flex h-14 bg-white border-b border-gray-200 items-center justify-end px-8 shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Hoş Geldiniz</p>
            <p className="text-sm font-black text-gray-900">{user?.displayName}</p>
          </div>
        </header>

        {/* Scrollable page content */}
        <main
          className="flex-1 overflow-auto p-3 md:p-8"
          style={{
            paddingLeft: 'max(env(safe-area-inset-left), 12px)',
            paddingRight: 'max(env(safe-area-inset-right), 12px)',
          }}
        >
          <Outlet />
        </main>

        {/* ── MOBILE BOTTOM NAV ── */}
        <nav
          className="md:hidden flex bg-white border-t border-gray-200 shrink-0"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: 'env(safe-area-inset-right)',
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors text-[10px] font-semibold',
                  active ? 'text-blue-700' : 'text-gray-400'
                )}
              >
                <div className={cn(
                  'p-1.5 rounded-xl transition-colors',
                  active ? 'bg-blue-50' : ''
                )}>
                  <Icon className={cn('w-5 h-5', active ? 'text-blue-700' : 'text-gray-400')} />
                </div>
                <span className="leading-none">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
