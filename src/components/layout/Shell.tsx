'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../lib/store';
import { logout } from '../../lib/actions/auth';
import { logSessionRecoveryAction } from '../../lib/actions/backups';
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
  Truck,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  HelpCircle
} from 'lucide-react';
import ToastContainer from '../ui/ToastContainer';

export default function Shell({ children, userName, shopName }: { children: React.ReactNode; userName: string; shopName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, language, toggleLanguage } = useTranslation();
  const { theme, toggleTheme } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // Recovery & PWA States
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // 1. Sidebar state recovery
    const savedSidebar = localStorage.getItem('sidebar_collapsed');
    if (savedSidebar === 'true') {
      setSidebarCollapsed(true);
    }



    // 3. PWA install prompt handler
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // 4. Session recovery validation (checks 24-hour expiration threshold)
    const keys = ['draft_sales_pos', 'draft_purchase_form', 'draft_expense_form'];
    let hasValidDraft = false;
    const now = Date.now();

    for (const key of keys) {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.savedAt && now - parsed.savedAt <= 24 * 60 * 60 * 1000) {
            hasValidDraft = true;
          } else {
            // Expired (>24 hours) - clean up silently
            localStorage.removeItem(key);
          }
        } catch (e) {
          localStorage.removeItem(key);
        }
      }
    }

    if (hasValidDraft && !localStorage.getItem('draft_restore_prompted')) {
      setShowRestorePrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [router]);

  // 5. Track last page visited
  useEffect(() => {
    if (pathname && pathname !== '/' && pathname !== '/dashboard/closing') {
      localStorage.setItem('last_visited_page', pathname);
    }
  }, [pathname]);

  const handleToggleSidebar = () => {
    const nextState = !sidebarCollapsed;
    setSidebarCollapsed(nextState);
    localStorage.setItem('sidebar_collapsed', nextState ? 'true' : 'false');
  };

  const handleLogout = async () => {
    // Keep local persistence preferences but clean visited page path
    localStorage.removeItem('last_visited_page');
    await logout();
    router.replace('/');
  };

  const handleRestoreDrafts = async () => {
    localStorage.setItem('draft_restore_approved', 'true');
    localStorage.setItem('draft_restore_prompted', 'true');
    setShowRestorePrompt(false);

    // Record recovery in Audit Logs
    await logSessionRecoveryAction('User restored unsaved form/checkout states from previous session.');
    window.location.reload();
  };

  const handleDiscardDrafts = () => {
    localStorage.removeItem('draft_sales_pos');
    localStorage.removeItem('draft_purchase_form');
    localStorage.removeItem('draft_expense_form');
    localStorage.removeItem('draft_restore_approved');
    localStorage.setItem('draft_restore_prompted', 'true');
    setShowRestorePrompt(false);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install outcome: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBtn(false);
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
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all">
      
      {/* DESKTOP SIDEBAR */}
      <aside className={`hidden md:flex flex-col ${sidebarCollapsed ? 'w-20' : 'w-64'} bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 transition-all duration-300`}>
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          {!sidebarCollapsed ? (
            <div>
              <h1 className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400 truncate w-40">
                {shopName || 'Punjab Shop'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate w-40">
                {userName}
              </p>
            </div>
          ) : (
            <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">POS</span>
          )}
          <button
            onClick={handleToggleSidebar}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-850 rounded text-slate-550 transition-colors"
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
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
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 font-extrabold shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-5 h-5 mr-3 shrink-0" />
                {!sidebarCollapsed && item.name}
              </Link>
            );
          })}
        </nav>

        {/* PWA desktop install trigger */}
        {showInstallBtn && !sidebarCollapsed && (
          <div className="p-4 mx-4 mb-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/40 text-xs">
            <p className="font-bold text-emerald-800 dark:text-emerald-400">Punjab Shop POS App</p>
            <button
              onClick={handleInstallClick}
              className="mt-2 w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-all text-[11px]"
            >
              Install Desktop App
            </button>
          </div>
        )}

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {/* Theme & Language Toggles */}
          <div className={`flex ${sidebarCollapsed ? 'flex-col' : 'flex-row'} gap-2`}>
            <button
              onClick={toggleLanguage}
              className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-850"
            >
              {sidebarCollapsed ? (language === 'en' ? 'ਪੰ' : 'EN') : (language === 'en' ? 'ਪੰਜਾਬੀ' : 'English')}
            </button>
            <button
              onClick={toggleTheme}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-850 flex justify-center"
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
          {!sidebarCollapsed && (
            <button
              onClick={() => setShowHelpModal(true)}
              className="flex items-center text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 w-full px-4 py-1.5 transition-colors"
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              ਮਦਦ (Help / Shortcuts)
            </button>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-red-650 dark:text-red-400 hover:bg-red-55 dark:hover:bg-red-950/20 rounded-lg transition-all"
          >
            <LogOut className="w-5 h-5 mr-3 shrink-0" />
            {!sidebarCollapsed && t('logout')}
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
            {showInstallBtn && (
              <button
                onClick={handleInstallClick}
                className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold"
              >
                Install
              </button>
            )}
            <button
              onClick={toggleLanguage}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold bg-slate-55 dark:bg-slate-800"
            >
              {language === 'en' ? 'ਪੰ' : 'EN'}
            </button>
            <button
              onClick={toggleTheme}
              className="p-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-55 dark:bg-slate-800"
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

        {/* Page Content & Recovery Overlay Banner */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          
          {/* Recovery Prompt Banner Overlay */}
          {showRestorePrompt && (
            <div className="bg-indigo-600 dark:bg-indigo-950 text-white px-4 py-3 rounded-xl mb-6 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 border border-indigo-500/20 animate-pulse">
              <div className="flex items-center gap-3">
                <span className="text-xl">⏳</span>
                <div>
                  <p className="font-extrabold text-sm">Restore Unsaved Session? / ਪਿਛਲਾ ਸੈਸ਼ਨ ਬਹਾਲ ਕਰੋ?</p>
                  <p className="text-xs text-indigo-200">We found an unsaved transaction draft from your last session (less than 24h old).</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleRestoreDrafts}
                  className="px-4 py-1.5 bg-white text-indigo-700 hover:bg-zinc-100 rounded-lg text-xs font-bold transition-all shadow"
                >
                  Restore (ਬਹਾਲ ਕਰੋ)
                </button>
                <button
                  onClick={handleDiscardDrafts}
                  className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all border border-indigo-400/30"
                >
                  Discard (ਰੱਦ ਕਰੋ)
                </button>
              </div>
            </div>
          )}

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

        {/* Global Toast Container */}
        <ToastContainer />

        {/* Help / Keyboard Shortcuts Modal */}
        {showHelpModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 no-print">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden p-6 relative">
              <button
                onClick={() => setShowHelpModal(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b pb-2 mb-4">
                ਕੀਬੋਰਡ ਸ਼ਾਰਟਕੱਟ (Keyboard Shortcuts)
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-blue-600 dark:text-blue-400">F2</span>
                  <span className="text-slate-600 dark:text-slate-400">POS ਬਿੱਲ ਪੂਰਾ ਕਰੋ (Complete Checkout)</span>
                </div>
                <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-blue-600 dark:text-blue-400">F3</span>
                  <span className="text-slate-600 dark:text-slate-400">ਗਾਹਕ ਜੋੜੋ (Add Customer Modal)</span>
                </div>
                <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-blue-600 dark:text-blue-400">Esc</span>
                  <span className="text-slate-600 dark:text-slate-400">ਕਾਰਟ ਖਾਲੀ ਕਰੋ / ਮੋਡਲ ਬੰਦ ਕਰੋ (Clear Cart / Close)</span>
                </div>
                <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-blue-600 dark:text-blue-400">Enter</span>
                  <span className="text-slate-600 dark:text-slate-400">ਅਗਲੇ ਖਾਨੇ 'ਤੇ ਜਾਓ (Move to next input field)</span>
                </div>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="mt-6 w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-200"
              >
                ਬੰਦ ਕਰੋ (Close)
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
