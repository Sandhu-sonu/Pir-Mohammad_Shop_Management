import React from 'react';
import { getCurrentUser } from '@/lib/actions/auth';
import { prisma } from '@/db/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Role } from '@prisma/client';
import { cookies } from 'next/headers';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  
  // Note: Since getCurrentUser() overrides the active session parameters 
  // during active impersonation (switching role to VIEW_ONLY), we check 
  // if the raw session cookie userId exists and is a Super Admin in DB.
  let isSuperAdmin = false;
  if (user) {
    const rawSession = cookieStore.get('session');
    if (rawSession && rawSession.value) {
      try {
        const sessionObj = JSON.parse(rawSession.value);
        const dbUser = await prisma?.user.findUnique({
          where: { id: sessionObj.userId },
          select: { role: true }
        });
        if (dbUser && dbUser.role === Role.SUPER_ADMIN) {
          isSuperAdmin = true;
        }
      } catch {}
    }
  }

  if (!user || !isSuperAdmin) {
    redirect('/');
  }

  const isImpersonating = cookieStore.get('impersonatedShopId') !== undefined;

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col justify-between p-6">
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-wider">PRMS Admin</h1>
            <p className="text-xs text-gray-500 mt-1 uppercase font-bold tracking-widest">SaaS Control Panel</p>
          </div>

          <nav className="space-y-2">
            <Link href="/admin" className="flex items-center space-x-3 text-sm text-gray-300 hover:text-white p-3 rounded-xl hover:bg-gray-800 transition duration-150">
              <span>📊</span>
              <span>Dashboard / ਡੈਸ਼ਬੋਰਡ</span>
            </Link>
            <Link href="/admin/shops" className="flex items-center space-x-3 text-sm text-gray-300 hover:text-white p-3 rounded-xl hover:bg-gray-800 transition duration-150">
              <span>🏪</span>
              <span>Tenant Shops / ਦੁਕਾਨਾਂ</span>
            </Link>
            <Link href="/admin/plans" className="flex items-center space-x-3 text-sm text-gray-300 hover:text-white p-3 rounded-xl hover:bg-gray-800 transition duration-150">
              <span>💳</span>
              <span>Plans & Feature limits</span>
            </Link>
            <Link href="/admin/support" className="flex items-center space-x-3 text-sm text-gray-300 hover:text-white p-3 rounded-xl hover:bg-gray-800 transition duration-150">
              <span>🎫</span>
              <span>Support Tickets / ਸਹਾਇਤਾ</span>
            </Link>
            <Link href="/admin/health" className="flex items-center space-x-3 text-sm text-gray-300 hover:text-white p-3 rounded-xl hover:bg-gray-800 transition duration-150">
              <span>🖥️</span>
              <span>System Health / ਸਥਿਤੀ</span>
            </Link>
          </nav>
        </div>

        <div className="space-y-4">
          {isImpersonating && (
            <div className="bg-orange-950 border border-orange-800 p-3 rounded-xl text-center">
              <p className="text-xs text-orange-400 font-bold mb-2">Impersonation Active</p>
              <Link href="/dashboard" className="text-xs text-white underline block font-bold">
                Go to Shop View
              </Link>
            </div>
          )}

          <div className="text-xs text-gray-600 border-t border-gray-800 pt-4">
            Logged in: <span className="text-gray-400 font-semibold">{user.name}</span>
          </div>

          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="w-full bg-red-950 border border-red-900 text-red-400 font-bold py-2.5 rounded-xl hover:bg-opacity-95 text-xs transition duration-200">
              Sign Out / ਲਾਗ ਆਉਟ
            </button>
          </form>
        </div>
      </aside>

      {/* Main Administrative Container */}
      <main className="flex-grow p-8 overflow-y-auto max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
