'use client';

import React, { useEffect, useState } from 'react';
import { getSystemHealthAction } from '../../lib/actions/health';
import { ShieldCheck, Database, HardDrive, RefreshCw, Activity } from 'lucide-react';

export default function SystemHealthWidget() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHealth = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getSystemHealthAction();
      if (res.success) {
        setHealth(res.health);
      } else {
        setError(res.error || 'Failed to load health diagnostics');
      }
    } catch (err: any) {
      setError(err.message || 'Error executing health check');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-500" />
        <p className="text-sm font-bold">Querying system diagnostics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl">
        <p className="font-bold">System Health Error</p>
        <p className="text-xs mt-1">{error}</p>
        <button
          onClick={fetchHealth}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all"
        >
          Retry Check
        </button>
      </div>
    );
  }

  const cards = [
    {
      title: 'App Version',
      value: `v${health.appVersion}`,
      desc: 'Latest commercial build',
      icon: ShieldCheck,
      color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/25',
    },
    {
      title: 'Database Status',
      value: health.dbStatus,
      desc: `Size: ${health.dbSize}`,
      icon: Database,
      color: health.dbStatus === 'CONNECTED' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/25' : 'text-amber-600 bg-amber-50 dark:bg-amber-950/25',
    },
    {
      title: 'Backup Storage',
      value: `${health.backupFileCount} Backups`,
      desc: `Disk Space: ${health.backupFolderSize}`,
      icon: HardDrive,
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/25',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold">ਸਿਸਟਮ ਦੀ ਤੰਦਰੁਸਤੀ (System Health diagnostics)</h3>
          <p className="text-xs text-slate-550 dark:text-slate-400">Database connections, size indices, and storage scopes</p>
        </div>
        <button
          onClick={fetchHealth}
          className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          title="Refresh diagnostics"
        >
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-start gap-4 shadow-sm"
            >
              <div className={`p-3 rounded-xl ${card.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block">{card.title}</span>
                <span className="text-xl font-black block mt-0.5 tracking-tight dark:text-white">{card.value}</span>
                <span className="text-[10px] text-slate-450 dark:text-slate-500 mt-1 block">{card.desc}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Logs Table / Checklist */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-450 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
          Financial Operations & Backup Audit
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="border border-slate-150 dark:border-slate-800 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="font-bold text-slate-500">ਆਖਰੀ ਬੈਕਅੱਪ (Last Database Backup)</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {health.lastBackup ? new Date(health.lastBackup).toLocaleString() : 'Never'}
              </p>
            </div>
            <span className={`px-2 py-1 rounded text-[10px] font-extrabold ${health.lastBackupStatus === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20' : 'bg-rose-50 text-rose-700'}`}>
              {health.lastBackupStatus}
            </span>
          </div>

          <div className="border border-slate-150 dark:border-slate-800 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="font-bold text-slate-500">ਆਖਰੀ ਰੀਸਟੋਰ (Last Database Restore)</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {health.lastRestore ? new Date(health.lastRestore).toLocaleString() : 'Never'}
              </p>
            </div>
            <span className={`px-2 py-1 rounded text-[10px] font-extrabold ${health.lastRestoreStatus === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20' : health.lastRestoreStatus === 'NONE' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' : 'bg-rose-50 text-rose-700'}`}>
              {health.lastRestoreStatus}
            </span>
          </div>

          <div className="border border-slate-150 dark:border-slate-800 rounded-xl p-4 sm:col-span-2 flex justify-between items-center">
            <div>
              <p className="font-bold text-slate-500">ਆਖਰੀ ਰੋਜ਼ਾਨਾ ਕਲੋਜ਼ਿੰਗ (Last Daily Closing)</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {health.lastClosing ? new Date(health.lastClosing).toLocaleDateString() : 'No locked closeout'}
              </p>
            </div>
            <span className={`px-2 py-1 rounded text-[10px] font-extrabold ${health.lastClosing ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/20' : 'bg-amber-50 text-amber-700'}`}>
              {health.lastClosing ? 'LOCKED' : 'PENDING'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
