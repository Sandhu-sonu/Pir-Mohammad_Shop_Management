'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../lib/store';
import { logout } from '../../lib/actions/auth';
import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  Users,
  ReceiptIndianRupee,
  FileBarChart,
  Settings,
  LogOut,
  Sun,
  Moon,
  TrendingDown,
  Truck
} from 'lucide-react';

export default function Shell({ children, userName, shopName }: { children: React.ReactNode; userName: string; shopName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, language, toggleLanguage } = useTranslation();
  const { theme, toggleTheme } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const navItems = [
    { name: t('dashboard'), path: '/dashboard', icon: LayoutDashboard },
    { name: t('inventory'), path: '/inventory', icon: Boxes },
    { name: t('sales'), path: '/sales', icon: ShoppingCart },
    { name: t('purchases'), path: '/purchases', icon: ReceiptIndianRupee },
    { name: t('suppliers'), path: '/suppliers', icon: Truck },
    { name: t('customers'), path: '/customers', icon: Users },
    { name: t('expenses'), path: '/expenses', icon: TrendingDown },
    { name: t('reports'), path: '/reports', icon: FileBarChart },
    { name: t('settings'), path: '/settings', icon: Settings },
  ];

  if (!mounted) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950" />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {shopName || 'Punjab Shop'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('dashboard')} - {userName}
          </p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-5 h-5 mr-3 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {/* Theme & Language Toggles */}
          <div className="flex gap-2">
            <button
              onClick={toggleLanguage}
              className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-850"
            >
              {language === 'en' ? 'ਪੰਜਾਬੀ' : 'English'}
            </button>
            <button
              onClick={toggleTheme}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-850"
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all"
          >
            <LogOut className="w-5 h-5 mr-3" />
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER & BOTTOM NAV */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        
        {/* Top Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
          <div>
            <h1 className="text-md font-bold text-blue-600 dark:text-blue-400 leading-tight">
              {shopName || 'Punjab Shop'}
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {userName}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLanguage}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold bg-slate-50 dark:bg-slate-800"
            >
              {language === 'en' ? 'ਪੰ' : 'EN'}
            </button>
            <button
              onClick={toggleTheme}
              className="p-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button
              onClick={handleLogout}
              className="p-1.5 text-red-650 hover:bg-slate-50 dark:hover:bg-slate-800 rounded"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around h-16 z-50">
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname.startsWith(item.path);
            const Icon = item.icon;
            
            // Extract short label for bottom tabs to avoid overflows
            let label = item.name.split(' ')[0];
            if (label.includes('(')) label = label.split('(')[0];

            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-bold ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span>{label}</span>
              </Link>
            );
          })}
          {/* Mobile Settings Tab */}
          <Link
            href="/settings"
            className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-bold ${
              pathname.startsWith('/settings')
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Settings className="w-5 h-5 mb-1" />
            <span>{t('settings').split(' ')[0]}</span>
          </Link>
        </nav>

      </div>
    </div>
  );
}
