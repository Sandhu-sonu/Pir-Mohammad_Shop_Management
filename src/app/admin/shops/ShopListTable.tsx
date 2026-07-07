'use client';

import React, { useState, useEffect } from 'react';
import { toggleShopSuspensionAction, resetShopOwnerPasswordAction, deleteShopAction } from '@/lib/actions/admin';
import { impersonateShopAction } from '@/lib/actions/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  currentPage: number;
  totalPages: number;
  totalCount: number;
  currentSearch: string;
  currentStatus: string;
}

export default function ShopListTable({
  initialShops,
  currentPage,
  totalPages,
  totalCount,
  currentSearch,
  currentStatus,
}: ShopListTableProps) {
  const router = useRouter();
  const [shops, setShops] = useState<ShopItem[]>(initialShops);
  const [search, setSearch] = useState(currentSearch);
  const [status, setStatus] = useState(currentStatus);
  
  const [resetId, setResetId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Sync initialShops when route changes
  useEffect(() => {
    setShops(initialShops);
  }, [initialShops]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const queryParams = new URLSearchParams();
    if (search.trim()) queryParams.set('search', search.trim());
    if (status) queryParams.set('status', status);
    queryParams.set('page', '1'); // reset page to 1
    router.push(`/admin/shops?${queryParams.toString()}`);
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    const queryParams = new URLSearchParams();
    if (search.trim()) queryParams.set('search', search.trim());
    if (status) queryParams.set('status', status);
    queryParams.set('page', page.toString());
    router.push(`/admin/shops?${queryParams.toString()}`);
  };

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
    if (!newPassword.trim() || newPassword.length < 6) {
      setActionError('Password must be at least 6 characters.');
      return;
    }

    const res = await resetShopOwnerPasswordAction(shopId, newPassword);
    if (res.success) {
      setActionSuccess('Owner password reset successfully.');
      setResetId(null);
      setNewPassword('');
    } else {
      setActionError(res.error || 'Password reset failed.');
    }
  };

  const handleDeleteShop = async (shopId: string) => {
    setActionError('');
    setActionSuccess('');
    const res = await deleteShopAction(shopId);
    if (res.success) {
      setShops(prev => prev.filter(s => s.id !== shopId));
      setActionSuccess('Shop and all cascading databases pruned successfully.');
      setDeleteConfirmId(null);
    } else {
      setActionError(res.error || 'Shop deletion failed.');
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

      {/* Filter panel form */}
      <form onSubmit={handleFilterSubmit} className="flex flex-col md:flex-row gap-4 items-end bg-gray-950/40 p-4 rounded-xl border border-gray-800">
        <div className="flex-1 w-full space-y-1.5">
          <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Search Shop / Owner</label>
          <input
            type="text"
            placeholder="Search by name, owner, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-950 border border-gray-850 rounded-xl p-2.5 text-white text-xs focus:outline-none"
          />
        </div>

        <div className="w-full md:w-48 space-y-1.5">
          <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Subscription Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-gray-950 border border-gray-850 rounded-xl p-2.5 text-white text-xs focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="TRIAL">Trial</option>
            <option value="EXPIRED">Expired</option>
            <option value="UNPAID">Unpaid</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full md:w-32 bg-primary hover:bg-opacity-95 text-white font-bold py-2.5 rounded-xl text-xs transition border border-primary/20"
          style={{ backgroundColor: '#FF6B6B' }}
        >
          Apply Filters
        </button>
      </form>

      {/* Table list */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-300">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs">
              <th className="py-3 px-4">Shop details</th>
              <th className="py-3 px-4">Subscription plan</th>
              <th className="py-3 px-4 text-center">Stats (Prod/Sale/Cust/User)</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shops.map((s) => (
              <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 text-xs">
                <td className="py-4 px-4">
                  <Link
                    href={`/admin/shops/${s.id}`}
                    className="font-bold text-white text-sm hover:underline hover:text-[#FF6B6B] transition block"
                  >
                    {s.name}
                  </Link>
                  <div className="text-[10px] text-gray-500 mt-0.5">Phone: {s.phone} | ID: {s.id.substring(0, 8)}...</div>
                </td>
                <td className="py-4 px-4 font-medium">
                  {s.planName} <span className="text-[10px] text-gray-500">({s.status})</span>
                </td>
                <td className="py-4 px-4 text-center font-semibold text-white">
                  {s.stats.products} / {s.stats.sales} / {s.stats.customers} / {s.stats.users}
                </td>
                <td className="py-4 px-4">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    s.isSuspended ? 'bg-red-950 text-red-400' : 'bg-green-950 text-green-400'
                  }`}>
                    {s.isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                  </span>
                </td>
                <td className="py-4 px-4 text-right space-x-1.5 space-y-1">
                  <button
                    onClick={() => handleImpersonate(s.id)}
                    className="bg-emerald-950 hover:bg-emerald-900 text-emerald-400 text-[10px] font-bold px-2 py-1.5 rounded-lg border border-emerald-900 transition"
                  >
                    Impersonate
                  </button>
                  <button
                    onClick={() => handleToggleSuspend(s.id, s.isSuspended)}
                    className={`${
                      s.isSuspended ? 'bg-green-950 text-green-400 border-green-900' : 'bg-red-950 text-red-400 border-red-900'
                    } text-[10px] font-bold px-2 py-1.5 rounded-lg border hover:opacity-90 transition`}
                  >
                    {s.isSuspended ? 'Activate' : 'Suspend'}
                  </button>
                  <button
                    onClick={() => {
                      setResetId(s.id);
                      setActionError('');
                      setActionSuccess('');
                    }}
                    className="bg-gray-800 hover:bg-gray-700 text-white text-[10px] font-bold px-2 py-1.5 rounded-lg border border-gray-700 transition"
                  >
                    Reset Pass
                  </button>
                  <button
                    onClick={() => {
                      setDeleteConfirmId(s.id);
                      setActionError('');
                      setActionSuccess('');
                    }}
                    className="bg-red-950/20 hover:bg-red-950 text-red-400 text-[10px] font-bold px-2 py-1.5 rounded-lg border border-red-950 transition"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {shops.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500 font-bold">
                  No registered tenant shops matching criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center bg-gray-950/25 p-4 rounded-xl border border-gray-800 mt-2 text-xs">
          <p className="text-gray-500 font-medium">
            Showing Page <span className="font-bold text-white">{currentPage}</span> of <span className="font-bold text-white">{totalPages}</span> ({totalCount} Shops total)
          </p>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-1.5 px-3 rounded-lg border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-1.5 px-3 rounded-lg border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Password Reset Popup */}
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

      {/* Delete Confirmation Popup */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-gray-900 border border-red-900 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-red-400">🚨 Permanent Deletions WARNING</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Are you absolutely sure you want to permanently delete this shop? 
              <span className="text-red-500 font-bold block mt-1">This will cascade delete all users, products, sales, purchases, and settings. This action is irreversible.</span>
            </p>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteShop(deleteConfirmId)}
                className="flex-1 bg-red-950 text-red-400 border border-red-900 font-bold py-2 rounded-xl text-xs hover:bg-red-900 transition"
              >
                Prune Tenant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
