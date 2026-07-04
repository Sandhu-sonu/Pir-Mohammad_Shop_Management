import React from 'react';
import { prisma } from '@/db/prisma';
import { SystemHealthService } from '@/db/services/SystemHealthService';

export default async function AdminHealthPage() {
  const diag = await SystemHealthService.getDiagnostics();

  // Fetch database sizes (table counts)
  const [shopsCount, productsCount, salesCount, logsCount, ticketsCount] = await Promise.all([
    prisma.shop.count(),
    prisma.product.count({ where: { isDeleted: false } }),
    prisma.sale.count(),
    prisma.auditLog.count(),
    prisma.supportTicket.count()
  ]);

  // Fetch recent audit logs
  const auditLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
    include: {
      user: {
        select: { name: true, role: true }
      }
    }
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">System Health & Diagnostic Controls / ਸਥਿਤੀ</h2>
        <p className="text-gray-400 text-sm mt-1">Real-time database indexes, upload storage, and diagnostic telemetry</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Core Database stats */}
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl col-span-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Database Metrics</h3>
          <div className="border-t border-gray-800 pt-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Database Size:</span>
              <span className="text-white font-bold">{diag.dbSize}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Database Status:</span>
              <span className="text-green-400 font-bold">ONLINE</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Total Shops (Tenants):</span>
              <span className="text-white font-bold">{shopsCount}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Total Products:</span>
              <span className="text-white font-bold">{productsCount}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">POS Sales Logged:</span>
              <span className="text-white font-bold">{salesCount}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Telemetry Logs:</span>
              <span className="text-white font-bold">{logsCount}</span>
            </div>
          </div>
        </div>

        {/* Telemetry diagnostics */}
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Environment & Diagnostics</h3>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80 text-xs">
              <p className="text-[10px] text-gray-500 uppercase font-bold">Application Version</p>
              <p className="text-sm font-extrabold text-white mt-1">{diag.appVersion}</p>
            </div>
            <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80 text-xs">
              <p className="text-[10px] text-gray-500 uppercase font-bold">Database Version</p>
              <p className="text-sm font-extrabold text-white mt-1 line-clamp-1">{diag.dbVersion}</p>
            </div>
            <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80 text-xs">
              <p className="text-[10px] text-gray-500 uppercase font-bold">Prisma Version</p>
              <p className="text-sm font-extrabold text-white mt-1">{diag.prismaVersion}</p>
            </div>
            <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80 text-xs">
              <p className="text-[10px] text-gray-500 uppercase font-bold">Node.js Version</p>
              <p className="text-sm font-extrabold text-white mt-1">{diag.nodeVersion}</p>
            </div>
            <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80 text-xs col-span-2">
              <p className="text-[10px] text-gray-500 uppercase font-bold">Operating System</p>
              <p className="text-xs font-bold text-white mt-1">{diag.osPlatform}</p>
            </div>
            <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80 text-xs">
              <p className="text-[10px] text-gray-500 uppercase font-bold">Server Time / Timezone</p>
              <p className="text-xs font-bold text-white mt-1">{diag.serverTime} ({diag.timezone})</p>
            </div>
            <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80 text-xs">
              <p className="text-[10px] text-gray-500 uppercase font-bold">Uptime / Active Sessions</p>
              <p className="text-xs font-bold text-emerald-400 mt-1">{diag.uptime}s / {diag.activeSessions} Users</p>
            </div>
            <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80 text-xs col-span-2">
              <p className="text-[10px] text-gray-500 uppercase font-bold">Last Backup Status</p>
              <p className="text-xs font-bold text-white mt-1">{diag.lastBackupTime}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Centralized Telemetry Audit Logs */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Centralized System Audit Logs / ਟੈਲੀਮੈਟਰੀ ਲੌਗਸ</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Operator</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 text-xs">
                  <td className="py-3.5 px-4 text-gray-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-white">
                    {log.user ? `${log.user.name} (${log.user.role})` : 'System'}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-orange-400">{log.action}</td>
                  <td className="py-3.5 px-4">{log.module}</td>
                  <td className="py-3.5 px-4 text-gray-400">{log.details || 'N/A'}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500 font-bold">
                    No telemetry logs found.
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
