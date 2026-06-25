'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
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
  IndianRupee,
  Package,
  AlertTriangle,
  Users,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

interface StatsProps {
  stats: {
    cards: {
      todaySales: number;
      todayProfit: number;
      inventoryValue: number;
      lowStockCount: number;
      pendingCustomerBalance: number;
      customerCount: number;
    };
    widgets: {
      salesTrend: {
        dateStr: string;
        dayEn: string;
        dayPa: string;
        amount: number;
      }[];
      topProducts: {
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

  const cardData = [
    {
      title: t('todaySales'),
      value: `₹${stats.cards.todaySales.toLocaleString('en-IN')}`,
      icon: TrendingUp,
      color: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border-emerald-200 dark:border-emerald-900',
    },
    {
      title: t('todayProfit'),
      value: `₹${stats.cards.todayProfit.toLocaleString('en-IN')}`,
      icon: IndianRupee,
      color: 'bg-teal-50 dark:bg-teal-950/20 text-teal-650 dark:text-teal-400 border-teal-200 dark:border-teal-900',
    },
    {
      title: t('inventoryValue'),
      value: `₹${stats.cards.inventoryValue.toLocaleString('en-IN')}`,
      icon: Package,
      color: 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900',
    },
    {
      title: t('lowStock'),
      value: stats.cards.lowStockCount.toString(),
      icon: AlertTriangle,
      color: stats.cards.lowStockCount > 0 
        ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border-rose-250 dark:border-rose-900 animate-pulse'
        : 'bg-slate-50 dark:bg-slate-900 text-slate-550 border-slate-200 dark:border-slate-800',
    },
    {
      title: t('pendingBalance'),
      value: `₹${stats.cards.pendingCustomerBalance.toLocaleString('en-IN')}`,
      icon: Users,
      color: 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-455 border-amber-200 dark:border-amber-900',
    },
    {
      title: t('activeCustomers'),
      value: stats.cards.customerCount.toString(),
      icon: Users,
      color: 'bg-purple-50 dark:bg-purple-950/20 text-purple-650 dark:text-purple-400 border-purple-200 dark:border-purple-900',
    },
  ];

  return (
    <div className="space-y-8">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cardData.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`p-6 rounded-2xl border-2 flex items-center justify-between shadow-sm bg-white dark:bg-slate-900 ${card.color}`}
            >
              <div>
                <p className="text-sm font-bold opacity-80">{card.title}</p>
                <p className="text-3xl font-extrabold tracking-tight mt-1">{card.value}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-800/40">
                <Icon className="w-8 h-8" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Widgets & Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Widget */}
        <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold flex items-center mb-4">
            <TrendingUp className="w-5 h-5 text-blue-500 mr-2" />
            {t('salesTrend')}
          </h3>
          
          <div className="h-64 flex-1">
            {mounted ? (
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
                      <Cell key={`cell-${index}`} fill={index === 6 ? '#2563eb' : '#93c5fd'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">Loading trend...</div>
            )}
          </div>
        </div>

        {/* Top Selling Products Widget */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold flex items-center mb-4">
            <Package className="w-5 h-5 text-blue-500 mr-2" />
            {t('topProducts')}
          </h3>
          
          <div className="flex-1 space-y-4">
            {stats.widgets.topProducts.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
                {t('noActivity')}
              </p>
            ) : (
              stats.widgets.topProducts.map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 last:border-b-0 last:pb-0">
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-bold truncate">
                      {language === 'pa' ? p.namePa : p.nameEn}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {p.totalQty} {p.unit}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-blue-650 dark:text-blue-400">
                      ₹{p.totalSales.toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">#{idx + 1}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Widget */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold flex items-center">
            <Clock className="w-5 h-5 text-blue-500 mr-2" />
            {t('recentActivity')}
          </h3>
          <Link
            href="/sales"
            className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center hover:underline"
          >
            Show All
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3">{t('invoiceNo')}</th>
                <th className="py-3">{t('customerName')}</th>
                <th className="py-3">{t('total')}</th>
                <th className="py-3">Method</th>
                <th className="py-3">Status</th>
                <th className="py-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {stats.widgets.recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500 dark:text-slate-400">
                    {t('noActivity')}
                  </td>
                </tr>
              ) : (
                stats.widgets.recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 font-semibold text-blue-600 dark:text-blue-450">
                      {tx.invoiceNumber}
                    </td>
                    <td className="py-3.5">{tx.customerName}</td>
                    <td className="py-3.5 font-bold">₹{tx.total.toLocaleString('en-IN')}</td>
                    <td className="py-3.5">
                      <span className="px-2.5 py-1 text-xs font-bold rounded bg-slate-100 dark:bg-slate-800">
                        {tx.method}
                      </span>
                    </td>
                    <td className="py-3.5">
                      {tx.isReversed ? (
                        <span className="flex items-center text-rose-500 text-xs font-bold gap-1">
                          <XCircle className="w-4 h-4" /> Reversed
                        </span>
                      ) : (
                        <span className="flex items-center text-emerald-500 text-xs font-bold gap-1">
                          <CheckCircle className="w-4 h-4" /> Paid
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 text-right text-xs text-slate-500 dark:text-slate-400">
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
