import React from 'react';
import { prisma } from '@/db/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubscriptionStatus } from '@prisma/client';

export default async function ShopDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const shop = await prisma.shop.findUnique({
    where: { id },
    include: {
      subscription: {
        include: {
          plan: {
            include: {
              features: {
                include: { feature: true }
              }
            }
          }
        }
      },
      users: {
        orderBy: { role: 'asc' }
      },
      _count: {
        select: {
          products: { where: { isDeleted: false } },
          sales: true,
          customers: { where: { isDeleted: false } },
          suppliers: { where: { isDeleted: false } },
          expenses: true,
          auditLogs: true
        }
      }
    }
  });

  if (!shop || shop.id === 'admin-system-shop-id') {
    notFound();
  }

  const sub = shop.subscription;

  return (
    <div className="space-y-8">
      {/* Header and Back button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Link
            href="/admin/shops"
            className="text-xs text-[#FF6B6B] hover:underline font-bold flex items-center gap-1.5 uppercase tracking-wider"
          >
            ← Back to Shops / ਦੁਕਾਨਾਂ ਦੀ ਸੂਚੀ
          </Link>
          <h2 className="text-2xl font-bold text-white mt-2">{shop.name}</h2>
          <p className="text-gray-400 text-sm mt-0.5">Shop ID: {shop.id}</p>
        </div>

        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${
          shop.isSuspended ? 'bg-red-950 text-red-400 border border-red-900' : 'bg-green-950 text-green-400 border border-green-900'
        }`}>
          {shop.isSuspended ? 'Locked / Suspended' : 'Online / Active'}
        </span>
      </div>

      {/* Grid splits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side Column: Profile & Stats */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Profile Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Business Details</h3>
            <div className="border-t border-gray-800/80 pt-4 space-y-3 text-sm text-gray-300">
              <div>
                <span className="text-gray-500 block text-xs uppercase font-bold tracking-wider">Phone / Mobile</span>
                <span className="font-bold text-white">{shop.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs uppercase font-bold tracking-wider">Business Type</span>
                <span className="font-bold text-white">{shop.businessType}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs uppercase font-bold tracking-wider">Created At</span>
                <span className="font-bold text-white">{new Date(shop.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Stats metrics */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Data Counters</h3>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-gray-950 p-3 rounded-xl border border-gray-850">
                <span className="text-[10px] text-gray-500 uppercase font-bold">Products</span>
                <p className="text-xl font-extrabold text-white mt-1">{shop._count.products}</p>
              </div>
              <div className="bg-gray-950 p-3 rounded-xl border border-gray-850">
                <span className="text-[10px] text-gray-500 uppercase font-bold">Total Sales</span>
                <p className="text-xl font-extrabold text-white mt-1">{shop._count.sales}</p>
              </div>
              <div className="bg-gray-950 p-3 rounded-xl border border-gray-850">
                <span className="text-[10px] text-gray-500 uppercase font-bold">Customers</span>
                <p className="text-xl font-extrabold text-white mt-1">{shop._count.customers}</p>
              </div>
              <div className="bg-gray-950 p-3 rounded-xl border border-gray-850">
                <span className="text-[10px] text-gray-500 uppercase font-bold">Expenses</span>
                <p className="text-xl font-extrabold text-white mt-1">{shop._count.expenses}</p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Side Column: Subscription & Staff */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Subscription and Limits Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-gray-800/80 pb-4">
              <h3 className="text-base font-bold text-white">Active Subscription / ਪਲਾਨ ਵੇਰਵਾ</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                sub?.status === SubscriptionStatus.ACTIVE ? 'bg-green-950 text-green-400' :
                sub?.status === SubscriptionStatus.TRIAL ? 'bg-blue-950 text-blue-400' :
                'bg-red-950 text-red-400'
              }`}>
                {sub?.status || 'INACTIVE'}
              </span>
            </div>

            {sub ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3 text-sm text-gray-300">
                  <div>
                    <span className="text-gray-500 block text-xs">Current Plan Tiers</span>
                    <span className="font-bold text-white text-base">{sub.plan.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Price Tier</span>
                    <span className="font-bold text-white">₹{sub.plan.price.toNumber()} / {sub.plan.billingPeriod}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Timeline dates</span>
                    <span className="font-bold text-white">
                      {new Date(sub.startDate).toLocaleDateString()} - {new Date(sub.endDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-950 p-4 rounded-xl border border-gray-850 space-y-3">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Features limits quota:</p>
                  {sub.plan.features.map((pf) => (
                    <div key={pf.id} className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">{pf.feature.name}</span>
                      <span className={`font-bold ${pf.enabled ? 'text-green-400' : 'text-gray-600'}`}>
                        {pf.enabled ? (
                          pf.limitValue > 0 ? `Max: ${pf.limitValue} (${pf.limitType})` : 'Unlimited ✔'
                        ) : 'Disabled ✖'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 font-medium">No active plan assigned to this tenant.</p>
            )}
          </div>

          {/* Users registry list */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Registered Users / ਸਟਾਫ ਸੂਚੀ</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs">
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Mobile / Username</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shop.users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-800/40 hover:bg-gray-800/20 text-xs">
                      <td className="py-3 px-3 font-bold text-white">{u.name}</td>
                      <td className="py-3 px-3">{u.mobile || u.name}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.role === 'OWNER' ? 'bg-[#FF6B6B]/15 text-[#FF6B6B]' :
                          u.role === 'MANAGER' ? 'bg-blue-950 text-blue-400' :
                          'bg-gray-800 text-gray-400'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.status === 'ACTIVE' ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {shop.users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-gray-500">
                        No registered staff users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
        
      </div>
    </div>
  );
}
