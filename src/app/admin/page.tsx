import React from 'react';
import { prisma } from '@/db/prisma';
import { SubscriptionStatus, SupportTicketStatus } from '@prisma/client';
import Link from 'next/link';
import { SystemHealthService } from '@/db/services/SystemHealthService';

export default async function AdminDashboardPage() {
  // 1. Fetch Tenant Counts
  const totalShops = await prisma.shop.count({ where: { id: { not: 'admin-system-shop-id' } } });
  const activeShops = await prisma.shop.count({
    where: {
      id: { not: 'admin-system-shop-id' },
      isSuspended: false,
      subscription: { status: SubscriptionStatus.ACTIVE }
    }
  });
  const trialShops = await prisma.shop.count({
    where: {
      id: { not: 'admin-system-shop-id' },
      isSuspended: false,
      subscription: { status: SubscriptionStatus.TRIAL }
    }
  });
  const expiredShops = await prisma.shop.count({
    where: {
      id: { not: 'admin-system-shop-id' },
      subscription: { status: SubscriptionStatus.EXPIRED }
    }
  });
  const suspendedShops = await prisma.shop.count({
    where: {
      id: { not: 'admin-system-shop-id' },
      isSuspended: true
    }
  });

  // 2. Shops Active Today (actions/transactions logged in the last 24 hours)
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  
  const activeTodayLogs = await prisma.auditLog.groupBy({
    by: ['shopId'],
    where: {
      createdAt: { gte: startOfToday },
      shopId: { not: null }
    }
  });
  const activeShopsTodayCount = activeTodayLogs.filter(log => log.shopId !== 'admin-system-shop-id').length;

  // 3. Online Shops (activity within the last 15 minutes)
  const fifteenMinutesAgo = new Date();
  fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);
  
  const onlineLogs = await prisma.auditLog.groupBy({
    by: ['shopId'],
    where: {
      createdAt: { gte: fifteenMinutesAgo },
      shopId: { not: null }
    }
  });
  const onlineShopsCount = onlineLogs.filter(log => log.shopId !== 'admin-system-shop-id').length;

  // 4. Monthly Recurring Revenue (MRR) & ARR
  const activeSubs = await prisma.subscription.findMany({
    where: { status: SubscriptionStatus.ACTIVE, shopId: { not: 'admin-system-shop-id' } },
    include: { plan: true }
  });
  const monthlyRevenue = activeSubs.reduce((acc, sub) => acc + sub.plan.price.toNumber(), 0);
  const annualRevenue = monthlyRevenue * 12;

  // 5. Renewals Due (Subscription ends in the next 7 days)
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const renewalsDueCount = await prisma.subscription.count({
    where: {
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
      endDate: {
        gte: new Date(),
        lte: sevenDaysFromNow
      },
      shopId: { not: 'admin-system-shop-id' }
    }
  });

  // 6. Open Support Tickets & Diagnostics
  const openSupportTicketsCount = await prisma.supportTicket.count({
    where: {
      status: SupportTicketStatus.OPEN,
      deletedAt: null
    }
  });
  
  const diag = await SystemHealthService.getDiagnostics();

  // 7. Recent onboarded shops
  const recentShops = await prisma.shop.findMany({
    where: { id: { not: 'admin-system-shop-id' } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      subscription: { include: { plan: true } }
    }
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Platform Dashboard / ਸਾਫਟਵੇਅਰ ਕੰਟਰੋਲ ਸੈਂਟਰ</h2>
        <p className="text-gray-400 text-sm mt-1">Real-time status indicators across all system entities</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
          <p className="text-xs font-bold text-gray-500 uppercase">Total Tenant Shops</p>
          <p className="text-3xl font-extrabold text-white mt-2">{totalShops}</p>
          <p className="text-[10px] text-gray-400 mt-1">Registered businesses</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
          <p className="text-xs font-bold text-gray-500 uppercase">Active Subscriptions</p>
          <p className="text-3xl font-extrabold text-green-400 mt-2">{activeShops}</p>
          <p className="text-[10px] text-gray-400 mt-1">Paid tiers active</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
          <p className="text-xs font-bold text-gray-500 uppercase">Trial Periods active</p>
          <p className="text-3xl font-extrabold text-blue-400 mt-2">{trialShops}</p>
          <p className="text-[10px] text-gray-400 mt-1">Trial accounts onboarded</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
          <p className="text-xs font-bold text-gray-500 uppercase">Expired / Suspended</p>
          <p className="text-3xl font-extrabold text-red-400 mt-2">{expiredShops} / {suspendedShops}</p>
          <p className="text-[10px] text-gray-400 mt-1">Access locks in effect</p>
        </div>
      </div>

      {/* Activity Monitor */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
          <p className="text-xs font-bold text-gray-500 uppercase">Online Shops (15m)</p>
          <p className="text-3xl font-extrabold text-emerald-400 mt-2">{onlineShopsCount}</p>
          <p className="text-[10px] text-gray-400 mt-1">Active concurrent sessions</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
          <p className="text-xs font-bold text-gray-500 uppercase">Shops Active Today</p>
          <p className="text-3xl font-extrabold text-white mt-2">{activeShopsTodayCount}</p>
          <p className="text-[10px] text-gray-400 mt-1">Action logs recorded today</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
          <p className="text-xs font-bold text-gray-500 uppercase">Open Support Tickets</p>
          <p className="text-3xl font-extrabold text-yellow-400 mt-2">{openSupportTicketsCount}</p>
          <p className="text-[10px] text-gray-400 mt-1">Awaiting support agent reply</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
          <p className="text-xs font-bold text-gray-500 uppercase">Renewals Due (7d)</p>
          <p className="text-3xl font-extrabold text-orange-400 mt-2">{renewalsDueCount}</p>
          <p className="text-[10px] text-gray-400 mt-1">Approaching subscription ends</p>
        </div>
      </div>

      {/* Financial Estimates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
          <p className="text-xs font-bold text-gray-500 uppercase">Monthly Recurring Revenue (MRR)</p>
          <p className="text-4xl font-black text-emerald-400 mt-2">₹{monthlyRevenue}</p>
          <p className="text-gray-400 text-xs mt-2">Aggregated active pricing tier configurations</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
          <p className="text-xs font-bold text-gray-500 uppercase">Annual Recurring Revenue (ARR)</p>
          <p className="text-4xl font-black text-white mt-2">₹{annualRevenue}</p>
          <p className="text-gray-400 text-xs mt-2">Estimated annualized baseline run rate</p>
        </div>
      </div>

      {/* Diagnostics & Recent Signups split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System health */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 lg:col-span-1 space-y-4">
          <h3 className="text-base font-bold text-white">System Diagnostics / ਹੈਲਥ ਸਟੇਟਸ</h3>
          <div className="border-t border-gray-800/80 pt-4 space-y-3 text-sm text-gray-300">
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Database size:</span>
              <span className="font-bold text-white">{diag.dbSize}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Uptime duration:</span>
              <span className="font-bold text-white">{Math.floor(diag.uptime / 3600)} Hours</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Node version:</span>
              <span className="font-bold text-white">{diag.nodeVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">DB version:</span>
              <span className="font-bold text-white text-xs truncate max-w-[150px]">{diag.dbVersion.substring(0, 15)}...</span>
            </div>
          </div>
          <Link
            href="/admin/health"
            className="block text-center bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 rounded-xl text-xs border border-gray-700 transition"
          >
            Open Full Health Monitor
          </Link>
        </div>

        {/* Recent signups list */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-base font-bold text-white mb-4">Recent Shop Signups / ਨਵੇਂ ਕਾਰੋਬਾਰ</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs">
                  <th className="py-2.5 px-3">Shop Name</th>
                  <th className="py-2.5 px-3">Business Type</th>
                  <th className="py-2.5 px-3">Plan Type</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Ends At</th>
                </tr>
              </thead>
              <tbody>
                {recentShops.map((s) => (
                  <tr key={s.id} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                    <td className="py-3 px-3 font-bold text-white">{s.name}</td>
                    <td className="py-3 px-3 text-xs">{s.businessType}</td>
                    <td className="py-3 px-3 text-xs">{s.subscription?.plan.name || 'No Plan'}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.subscription?.status === SubscriptionStatus.ACTIVE ? 'bg-green-950 text-green-400' :
                        s.subscription?.status === SubscriptionStatus.TRIAL ? 'bg-blue-950 text-blue-400' :
                        'bg-red-950 text-red-400'
                      }`}>
                        {s.subscription?.status || 'INACTIVE'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs text-gray-400">
                      {s.subscription ? new Date(s.subscription.endDate).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
                {recentShops.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500 font-bold">
                      No shops onboarded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

