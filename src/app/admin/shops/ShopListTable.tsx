'use client';

import React, { useState } from 'react';
import { toggleShopSuspensionAction, resetShopOwnerPasswordAction } from '@/lib/actions/admin';
import { impersonateShopAction } from '@/lib/actions/auth';
import { useRouter } from 'next/navigation';

interface ShopItem {
  id: string;
  name: string;
  phone: string;
  isSuspended: boolean;
  planName: string;
  status: string;
  stats: {
    products: number;
    sales: number;
    customers: number;
    suppliers: number;
    users: number;
  };
}

interface ShopListTableProps {
  initialShops: ShopItem[];
}

export default function ShopListTable({ initialShops }: ShopListTableProps) {
  const router = useRouter();
  const [shops, setShops] = useState<ShopItem[]>(initialShops);
  const [resetId, setResetId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const handleToggleSuspend = async (shopId: string, currentSuspended: boolean) => {
    setActionError('');
    setActionSuccess('');
    const res = await toggleShopSuspensionAction(shopId, !currentSuspended);
    if (res.success) {
      setShops(prev => prev.map(s => s.id === shopId ? { ...s, isSuspended: !currentSuspended } : s));
      setActionSuccess(`Shop suspension status updated successfully.`);
    } else {
      setActionError(res.error || 'Failed to update suspension status');
    }
  };

  const handleImpersonate = async (shopId: string) => {
    setActionError('');
    const res = await impersonateShopAction(shopId);
    if (res.success) {
      router.push('/dashboard');
      router.refresh();
    } else {
      setActionError('Failed to initiate impersonation context.');
    }
  };

  const handleResetPassword = async (shopId: string) => {
    setActionError('');
    setActionSuccess('');
    if (!newPassword.trim()) return;

    const res = await resetShopOwnerPasswordAction(shopId, newPassword);
    if (res.success) {
      setActionSuccess('Owner password reset successfully.');
      setResetId(null);
      setNewPassword('');
    } else {
      setActionError(res.error || 'Password reset failed.');
    }
  };

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="bg-red-950 text-red-400 p-3 rounded-xl text-xs font-semibold text-center border border-red-900">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="bg-green-950 text-green-400 p-3 rounded-xl text-xs font-semibold text-center border border-green-900">
          {actionSuccess}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-300">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="py-3 px-4">Shop details</th>
              <th className="py-3 px-4">Subscription plan</th>
              <th className="py-3 px-4 text-center">Stats (Prod/Sale/Cust/User)</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shops.map((s) => (
              <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                <td className="py-4 px-4">
                  <div className="font-bold text-white text-base">{s.name}</div>
                  <div className="text-xs text-gray-500">Phone: {s.phone} | ID: {s.id.substring(0, 8)}...</div>
                </td>
                <td className="py-4 px-4 font-medium">
                  {s.planName} <span className="text-xs text-gray-500">({s.status})</span>
                </td>
                <td className="py-4 px-4 text-center text-xs font-semibold text-white">
                  {s.stats.products} / {s.stats.sales} / {s.stats.customers} / {s.stats.users}
                </td>
                <td className="py-4 px-4">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    s.isSuspended ? 'bg-red-950 text-red-400' : 'bg-green-950 text-green-400'
                  }`}>
                    {s.isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                  </span>
                </td>
                <td className="py-4 px-4 text-right space-x-2">
                  <button
                    onClick={() => handleImpersonate(s.id)}
                    className="bg-emerald-950 hover:bg-emerald-900 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-900 transition duration-150"
                  >
                    Impersonate / ਓਪਨ
                  </button>
                  <button
                    onClick={() => handleToggleSuspend(s.id, s.isSuspended)}
                    className={`${
                      s.isSuspended ? 'bg-green-950 text-green-400 border-green-900' : 'bg-red-950 text-red-400 border-red-900'
                    } text-xs font-bold px-3 py-1.5 rounded-lg border hover:opacity-90 transition duration-150`}
                  >
                    {s.isSuspended ? 'Activate' : 'Suspend'}
                  </button>
                  <button
                    onClick={() => {
                      setResetId(s.id);
                      setActionError('');
                      setActionSuccess('');
                    }}
                    className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-700 transition duration-150"
                  >
                    Reset Pass
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Password Reset Popup modal */}
      {resetId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Reset Owner Password</h3>
            <p className="text-xs text-gray-400">
              This will update the hashed login password for the shopowner user.
            </p>
            <input
              type="text"
              placeholder="Enter new password (min 6 chars)..."
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none text-sm"
            />
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => {
                  setResetId(null);
                  setNewPassword('');
                }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResetPassword(resetId)}
                className="flex-1 bg-primary text-white font-bold py-2 rounded-xl text-xs hover:bg-opacity-90"
                style={{ backgroundColor: '#FF6B6B' }}
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
