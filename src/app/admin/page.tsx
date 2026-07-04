import React from 'react';
import { prisma } from '@/db/prisma';
import { SubscriptionStatus } from '@prisma/client';
import Link from 'next/link';

export default async function AdminDashboardPage() {
  // Fetch KPI counts
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
  const totalUsers = await prisma.user.count({ where: { shopId: { not: 'admin-system-shop-id' } } });

  // Get active plans list & estimate MRR
  const activeSubs = await prisma.subscription.findMany({
    where: { status: SubscriptionStatus.ACTIVE, shopId: { not: 'admin-system-shop-id' } },
    include: { plan: true }
  });
  const monthlyRevenue = activeSubs.reduce((acc, sub) => acc + sub.plan.price.toNumber(), 0);

  // Fetch recent shops onboarded
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
        <h2 className="text-2xl font-bold text-white">SaaS Overview / ਸੰਖੇਪ ਜਾਣਕਾਰੀ</h2>
        <p className="text-gray-400 text-sm mt-1">Real-time indicators across all tenant shops</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
          <p className="text-xs font-bold text-gray-500 uppercase">Total Tenant Shops</p>
          <p className="text-3xl font-extrabold text-white mt-2">{totalShops}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
          <p className="text-xs font-bold text-gray-500 uppercase">Active Subscriptions</p>
          <p className="text-3xl font-extrabold text-green-400 mt-2">{activeShops}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
          <p className="text-xs font-bold text-gray-500 uppercase">Trial Shops</p>
          <p className="text-3xl font-extrabold text-blue-400 mt-2">{trialShops}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
          <p className="text-xs font-bold text-gray-500 uppercase">Expired / Suspended</p>
          <p className="text-3xl font-extrabold text-red-400 mt-2">{expiredShops}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
          <p className="text-xs font-bold text-gray-500 uppercase">Monthly Revenue Estimate (MRR)</p>
          <p className="text-4xl font-black text-emerald-400 mt-2">₹{monthlyRevenue}</p>
          <p className="text-gray-600 text-xs mt-2">Based on current active subscriptions billing periods</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
          <p className="text-xs font-bold text-gray-500 uppercase">Total User Accounts</p>
          <p className="text-4xl font-black text-white mt-2">{totalUsers}</p>
          <p className="text-gray-600 text-xs mt-2">Owners, managers, and staff members across all branches</p>
        </div>
      </div>

      {/* Recent Onboarding List */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Recent Shop Signups / ਨਵੇਂ ਕਾਰੋਬਾਰ</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="py-3 px-4">Shop Name</th>
                <th className="py-3 px-4">Business Type</th>
                <th className="py-3 px-4">Plan Name</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Renewal Date</th>
              </tr>
            </thead>
            <tbody>
              {recentShops.map((s) => (
                <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/35">
                  <td className="py-4 px-4 font-bold text-white">{s.name}</td>
                  <td className="py-4 px-4">{s.businessType}</td>
                  <td className="py-4 px-4">{s.subscription?.plan.name || 'No Plan'}</td>
                  <td className="py-4 px-4">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      s.subscription?.status === SubscriptionStatus.ACTIVE ? 'bg-green-950 text-green-400' :
                      s.subscription?.status === SubscriptionStatus.TRIAL ? 'bg-blue-950 text-blue-400' :
                      'bg-red-950 text-red-400'
                    }`}>
                      {s.subscription?.status || 'INACTIVE'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
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
  );
}
