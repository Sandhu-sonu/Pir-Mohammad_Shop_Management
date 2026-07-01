'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Package,
  AlertTriangle,
  Users,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Lock,
  Activity,
  Truck,
  Wallet,
  Database,
  Calendar
} from 'lucide-react';
import Link from 'next/link';

interface StatsProps {
  stats: {
    role: string;
    cards: {
      todaySales: number;
      // Owner-only
      todayProfit?: number;
      todayExpenses?: number;
      cashAvailable?: number;
      customerOutstanding?: number;
      supplierOutstanding?: number;
      lowStockCount?: number;
      healthScore?: 'EXCELLENT' | 'GOOD' | 'ATTENTION' | 'CRITICAL';
      totalProducts?: number;
      monthlySales?: number;
      lastBackupTime?: string | null;
      // Staff-only
      billsCreated?: number;
      customersServed?: number;
      isClosedToday?: boolean;
    };
    widgets: {
      salesTrend?: {
        dateStr: string;
        dayEn: string;
        dayPa: string;
        amount: number;
      }[];
      topProducts?: {
        id: string;
        nameEn: string;
        namePa: string;
        unit: string;
        totalQty: number;
        totalSales: number;
      }[];
      recentTransactions: {
        id: string;
        invoiceNumber: string;
        customerName: string;
        total: number;
        method: string;
        isReversed: boolean;
        date: string;
      }[];
    };
  };
}

export default function DashboardClient({ stats }: StatsProps) {
  const { t, language } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950" />;
  }

  const isStaff = stats.role === 'STAFF' || stats.role === 'VIEW_ONLY';

  // --- STAFF / CASHIER VIEW ---
  if (isStaff) {
    const staffCards = [
      {
        title: t('todaySales'),
        value: `₹${stats.cards.todaySales.toLocaleString('en-IN')}`,
        icon: TrendingUp,
        color: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-455 border-emerald-250 dark:border-emerald-900',
      },
      {
        title: 'ਬਿੱਲ ਬਣਾਏ (Bills Created)',
        value: stats.cards.billsCreated?.toString() || '0',
        icon: FileText,
        color: 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-250 dark:border-blue-900',
      },
      {
        title: 'ਗਾਹਕ ਸੇਵਾ (Customers Served)',
        value: stats.cards.customersServed?.toString() || '0',
        icon: Users,
        color: 'bg-purple-50 dark:bg-purple-950/20 text-purple-650 dark:text-purple-400 border-purple-250 dark:border-purple-900',
      },
      {
        title: 'ਕਲੋਜ਼ਿੰਗ ਸਥਿਤੀ (Closing Status)',
        value: stats.cards.isClosedToday ? 'Locked (ਲਾਕ ਹੈ)' : 'Open (ਖੁੱਲ੍ਹਾ ਹੈ)',
        icon: stats.cards.isClosedToday ? Lock : Clock,
        color: stats.cards.isClosedToday
          ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-650 dark:text-rose-400 border-rose-250 dark:border-rose-900'
          : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-450 border-amber-250 dark:border-amber-900 animate-pulse',
      },
    ];

    return (
      <div className="space-y-8">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-150 dark:border-zinc-800 shadow-sm">
          <h2 className="text-xl font-black">ਕੈਸ਼ੀਅਰ ਡੈਸ਼ਬੋਰਡ (Cashier Dashboard)</h2>
          <p className="text-xs text-zinc-500 mt-1">Monitor billing status and closure states for today's shifts.</p>
        </div>

        {/* Staff cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {staffCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                className={`p-6 rounded-2xl border-2 flex items-center justify-between shadow-sm bg-white dark:bg-zinc-900 ${card.color}`}
              >
                <div>
                  <p className="text-xs font-bold opacity-80 uppercase tracking-wider">{card.title}</p>
                  <p className="text-2xl font-black tracking-tight mt-1">{card.value}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/60 dark:bg-zinc-800/40">
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Transactions */}
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold flex items-center">
              <Clock className="w-5 h-5 text-indigo-500 mr-2" />
              ਅੱਜ ਦੀਆਂ ਵਿਕਰੀਆਂ (Recent Billings)
            </h3>
            <Link
              href="/sales"
              className="text-xs font-bold text-indigo-650 dark:text-indigo-400 flex items-center hover:underline"
            >
              Show All
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
              <thead>
                <tr className="border-b border-zinc-150 dark:border-zinc-850 text-zinc-500 font-bold uppercase tracking-wider">
                  <th className="py-3">Invoice No</th>
                  <th className="py-3">Customer</th>
                  <th className="py-3">Total Amount</th>
                  <th className="py-3">Payment Method</th>
                  <th className="py-3">Status</th>
                  <th className="py-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                {stats.widgets.recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-zinc-500">
                      No billing transactions logged today.
                    </td>
                  </tr>
                ) : (
                  stats.widgets.recentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="py-3.5 font-bold text-indigo-600 dark:text-indigo-400">
                        {tx.invoiceNumber}
                      </td>
                      <td className="py-3.5">{tx.customerName}</td>
                      <td className="py-3.5 font-extrabold">₹{tx.total.toLocaleString('en-IN')}</td>
                      <td className="py-3.5">
                        <span className="px-2 py-0.5 font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-[10px]">
                          {tx.method}
                        </span>
                      </td>
                      <td className="py-3.5">
                        {tx.isReversed ? (
                          <span className="flex items-center text-rose-500 font-bold gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Reversed
                          </span>
                        ) : (
                          <span className="flex items-center text-emerald-500 font-bold gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Active
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 text-right text-zinc-500">
                        {new Date(tx.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // --- OWNER / MANAGER VIEW ---
  // Setup colors and indicators for Business Health Score
  const health = stats.cards.healthScore || 'GOOD';
  let healthTitle = 'GOOD (ਠੀਕ-ਠਾਕ)';
  let healthColor = 'bg-blue-50 dark:bg-blue-950/20 text-blue-655 dark:text-blue-400 border-blue-200 dark:border-blue-900';
  if (health === 'EXCELLENT') {
    healthTitle = 'EXCELLENT (ਬਹੁਤ ਵਧੀਆ)';
    healthColor = 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border-emerald-250 dark:border-emerald-900';
  } else if (health === 'ATTENTION') {
    healthTitle = 'ATTENTION REQUIRED (ਧਿਆਨ ਦਿਓ)';
    healthColor = 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-450 border-amber-250 dark:border-amber-900 animate-pulse';
  } else if (health === 'CRITICAL') {
    healthTitle = 'CRITICAL (ਗੰਭੀਰ ਚਿੰਤਾ)';
    healthColor = 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-455 border-rose-250 dark:border-rose-900 animate-bounce';
  }

  const lastBackupStr = stats.cards.lastBackupTime
    ? new Date(stats.cards.lastBackupTime).toLocaleDateString(language === 'pa' ? 'pa-IN' : 'en-US', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : (language === 'pa' ? 'ਕਦੇ ਨਹੀਂ (Never)' : 'Never');

  const ownerCards = [
    {
      title: t('todaySales'),
      value: `₹${(stats.cards.todaySales || 0).toLocaleString('en-IN')}`,
      icon: TrendingUp,
      color: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
    },
    {
      title: t('todayProfit'),
      value: `₹${(stats.cards.todayProfit || 0).toLocaleString('en-IN')}`,
      icon: IndianRupee,
      color: 'bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-900',
    },
    {
      title: 'ਅੱਜ ਦੇ ਖਰਚੇ (Today Expenses)',
      value: `₹${(stats.cards.todayExpenses || 0).toLocaleString('en-IN')}`,
      icon: TrendingDown,
      color: 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900',
    },
    {
      title: 'ਮਹੀਨੇ ਦੀ ਵਿਕਰੀ (Monthly Sales)',
      value: `₹${(stats.cards.monthlySales || 0).toLocaleString('en-IN')}`,
      icon: Calendar,
      color: 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900',
    },
    {
      title: 'ਗੱਲੇ ਵਿੱਚ ਨਕਦ (Cash Available)',
      value: `₹${(stats.cards.cashAvailable || 0).toLocaleString('en-IN')}`,
      icon: Wallet,
      color: 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900',
    },
    {
      title: 'ਗਾਹਕ ਉਧਾਰ (Customer Dues)',
      value: `₹${(stats.cards.customerOutstanding || 0).toLocaleString('en-IN')}`,
      icon: Users,
      color: 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    },
    {
      title: 'ਸਪਲਾਇਰ ਬਕਾਇਆ (Supplier Dues)',
      value: `₹${(stats.cards.supplierOutstanding || 0).toLocaleString('en-IN')}`,
      icon: Truck,
      color: 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900',
    },
    {
      title: 'ਕੁੱਲ ਉਤਪਾਦ (Total Products)',
      value: (stats.cards.totalProducts || 0).toString(),
      icon: Package,
      color: 'bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800',
    },
    {
      title: t('lowStock'),
      value: (stats.cards.lowStockCount || 0).toString(),
      icon: AlertTriangle,
      color: (stats.cards.lowStockCount || 0) > 0
        ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border-rose-250 dark:border-rose-900 animate-pulse'
        : 'bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800',
    },
    {
      title: 'ਆਖਰੀ ਬੈਕਅੱਪ (Last Backup)',
      value: lastBackupStr,
      icon: Database,
      color: 'bg-zinc-50 dark:bg-zinc-900/40 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800',
    },
    {
      title: 'ਵਪਾਰ ਦੀ ਸਿਹਤ (Business Health)',
      value: healthTitle,
      icon: Activity,
      color: healthColor,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Owner KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
        {ownerCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`p-6 rounded-2xl border-2 flex items-center justify-between shadow-sm bg-white dark:bg-slate-900 ${card.color}`}
            >
              <div>
                <p className="text-xs font-bold opacity-85 uppercase tracking-wider">{card.title}</p>
                <p className="text-2xl font-black tracking-tight mt-1">{card.value}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/60 dark:bg-zinc-800/40">
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Widgets & Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales Trend Widget */}
        <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <h3 className="text-md font-bold flex items-center mb-4 uppercase tracking-wider text-slate-500">
            <TrendingUp className="w-5 h-5 text-indigo-500 mr-2" />
            {t('salesTrend')} (ਵਿਕਰੀ ਰੁਝਾਨ)
          </h3>
          
          <div className="h-64 flex-1">
            {stats.widgets.salesTrend ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.widgets.salesTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey={language === 'pa' ? 'dayPa' : 'dayEn'} tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                    contentStyle={{
                      background: 'rgba(255, 255, 255, 0.95)',
                      color: '#000',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {stats.widgets.salesTrend.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 6 ? '#4f46e5' : '#a5b4fc'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-450">Loading sales trend...</div>
            )}
          </div>
        </div>

        {/* Top Selling Products Widget */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <h3 className="text-md font-bold flex items-center mb-4 uppercase tracking-wider text-slate-500">
            <Package className="w-5 h-5 text-indigo-500 mr-2" />
            {t('topProducts')} (ਵੱਧ ਵਿਕਣ ਵਾਲੇ ਉਤਪਾਦ)
          </h3>
          
          <div className="flex-1 space-y-4">
            {!stats.widgets.topProducts || stats.widgets.topProducts.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">{t('noActivity')}</p>
            ) : (
              stats.widgets.topProducts.map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3 last:border-b-0 last:pb-0">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold truncate">
                      {language === 'pa' ? p.namePa : p.nameEn}
                    </p>
                    <p className="text-[10px] text-slate-550 mt-0.5">
                      {p.totalQty} {p.unit}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                      ₹{p.totalSales.toLocaleString('en-IN')}
                    </p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Rank #{idx + 1}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-bold flex items-center uppercase tracking-wider text-slate-500">
            <Clock className="w-5 h-5 text-indigo-500 mr-2" />
            {t('recentActivity')} (ਤਾਜ਼ਾ ਗਤੀਵਿਧੀਆਂ)
          </h3>
          <Link
            href="/sales"
            className="text-xs font-bold text-indigo-650 dark:text-indigo-400 flex items-center hover:underline"
          >
            Show All
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3">{t('invoiceNo')}</th>
                <th className="py-3">{t('customerName')}</th>
                <th className="py-3">{t('total')}</th>
                <th className="py-3">Method</th>
                <th className="py-3">Status</th>
                <th className="py-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-zinc-700 dark:text-zinc-350">
              {stats.widgets.recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    {t('noActivity')}
                  </td>
                </tr>
              ) : (
                stats.widgets.recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 font-bold text-indigo-600 dark:text-indigo-400">
                      {tx.invoiceNumber}
                    </td>
                    <td className="py-3.5">{tx.customerName}</td>
                    <td className="py-3.5 font-extrabold">₹{tx.total.toLocaleString('en-IN')}</td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 font-bold rounded bg-slate-100 dark:bg-slate-800 text-[10px]">
                        {tx.method}
                      </span>
                    </td>
                    <td className="py-3.5">
                      {tx.isReversed ? (
                        <span className="flex items-center text-rose-500 font-bold gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Reversed
                        </span>
                      ) : (
                        <span className="flex items-center text-emerald-500 font-bold gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Active
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 text-right text-slate-500">
                      {new Date(tx.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
