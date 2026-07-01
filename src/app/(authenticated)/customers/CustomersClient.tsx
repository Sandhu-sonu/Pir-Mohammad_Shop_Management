'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { customerSchema } from '@/validation';
import { useTranslation } from '@/hooks/useTranslation';
import { addCustomerAction, deleteCustomerAction } from '@/lib/actions/customers';
import { z } from 'zod';
import { Search, Plus, UserCheck, Eye, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useToastStore } from '@/lib/store/toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';

type CustomerInputs = z.infer<typeof customerSchema>;

interface CustomersClientProps {
  customersData: {
    items: any[];
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
  currentFilters: {
    search: string;
    page: number;
  };
}

export default function CustomersClient({ customersData, currentFilters }: CustomersClientProps) {
  const { t } = useTranslation();
  const { showToast } = useToastStore();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchVal, setSearchVal] = useState(currentFilters.search);

  // Debounced search trigger
  useEffect(() => {
    if (searchVal === currentFilters.search) return;

    const delayDebounceFn = setTimeout(() => {
      applyFilters(searchVal, 1);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchVal]);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      mobile: '',
      address: '',
      notes: '',
      openingBalance: 0,
    },
  });

  const applyFilters = (search: string, pageNum = 1) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (pageNum > 1) params.set('page', pageNum.toString());

    startTransition(() => {
      router.push(`/customers?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(searchVal, 1);
  };

  const onCustomerSubmit = async (data: CustomerInputs) => {
    try {
      const res = await addCustomerAction(data);
      if (res && 'error' in res) {
        showToast(res.error || 'Error saving customer', 'error');
        return;
      }
      if (res.success) {
        showToast('Customer saved ✓', 'success');
        setIsOpen(false);
        reset();
        router.refresh();
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving customer', 'error');
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  return (
    <div className="space-y-6">
      
      {/* Filtering & Action Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder={t('searchCustomer')}
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-850 rounded-lg text-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>

        <button
          onClick={() => setIsOpen(true)}
          className="w-full sm:w-auto px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          {t('addCustomer')}
        </button>
      </div>

      {/* Customers List Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-900/50">
                <th className="py-4 px-6">{t('customerName')}</th>
                <th className="py-4 px-6">{t('mobile')}</th>
                <th className="py-4 px-6">{t('address')}</th>
                <th className="py-4 px-6 text-right">{t('currentBalance')}</th>
                <th className="py-4 px-6 text-center">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isPending ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400 font-semibold">
                    Loading customers...
                  </td>
                </tr>
              ) : customersData.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center">
                    <EmptyState
                      icon={UserCheck}
                      title="ਕੋਈ ਗਾਹਕ ਨਹੀਂ ਮਿਲਿਆ (No Customers Found)"
                      description="No Customers Registered Yet. Click 'Add Customer' to register your first customer."
                      actionLabel="ਨਵਾਂ ਗਾਹਕ (Add Customer)"
                      onAction={() => {
                        reset();
                        setIsOpen(true);
                      }}
                    />
                  </td>
                </tr>
              ) : (
                customersData.items.map((cust) => {
                  const balance = Number(cust.currentBalance);
                  const hasDues = balance > 0;
                  return (
                    <tr key={cust.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-md text-slate-900 dark:text-slate-100">
                          {cust.name}
                        </div>
                        {cust.notes && <div className="text-xs text-slate-400 mt-0.5">{cust.notes}</div>}
                      </td>
                      <td className="py-3.5 px-6 font-medium text-slate-700 dark:text-slate-350">
                        {cust.mobile || '-'}
                      </td>
                      <td className="py-3.5 px-6 text-slate-500 dark:text-slate-400">
                        {cust.address || '-'}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <span
                          className={`inline-block px-3 py-1.5 rounded-lg text-sm font-extrabold ${
                            hasDues
                              ? 'bg-amber-100 text-amber-705 dark:bg-amber-950/40 dark:text-amber-350'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-350'
                          }`}
                        >
                          {hasDues ? `₹${balance.toFixed(2)} DUES` : 'CLEAR'}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/customers/${cust.id}`}
                            className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-blue-650 flex items-center gap-1.5 text-xs font-bold"
                          >
                            <Eye className="w-4 h-4" />
                            ਬਹੀ ਖਾਤਾ (Statement)
                          </Link>
                          
                          <button
                            onClick={() => handleDeleteClick(cust.id, cust.name)}
                            className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-rose-600"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {customersData.pages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-850 flex items-center justify-between">
            <button
              disabled={currentFilters.page <= 1}
              onClick={() => applyFilters(searchVal, currentFilters.page - 1)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm font-bold">
              Page {currentFilters.page} of {customersData.pages}
            </span>
            <button
              disabled={currentFilters.page >= customersData.pages}
              onClick={() => applyFilters(searchVal, currentFilters.page + 1)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ADD CUSTOMER MODAL */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-500" />
                ਨਵਾਂ ਗਾਹਕ ਖਾਤਾ (Create Customer Profile)
              </h2>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onCustomerSubmit)} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t('customerName')}</label>
                <input
                  type="text"
                  {...register('name')}
                  className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-sm font-semibold"
                  placeholder="e.g. Gurpreet Singh"
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t('mobile')}</label>
                <input
                  type="text"
                  {...register('mobile')}
                  className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-sm font-bold"
                  placeholder="e.g. 9888877777"
                />
                {errors.mobile && <p className="mt-1 text-xs text-red-500">{errors.mobile.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t('address')}</label>
                <input
                  type="text"
                  {...register('address')}
                  className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-sm"
                  placeholder="e.g. Model Town, Jalandhar"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t('openingBalance')}</label>
                  <input
                    type="number"
                    step="any"
                    {...register('openingBalance')}
                    className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-sm font-extrabold text-amber-600"
                  />
                  {errors.openingBalance && <p className="mt-1 text-xs text-red-500">{errors.openingBalance.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t('notes')}</label>
                  <input
                    type="text"
                    {...register('notes')}
                    className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-sm"
                    placeholder="Remarks"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Customer Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="ਗਾਹਕ ਨੂੰ ਮਿਟਾਓ? (Delete Customer?)"
        message={`ਕੀ ਤੁਸੀਂ ਸੱਚਮੁੱਚ ਗਾਹਕ "${deleteTarget?.name}" ਨੂੰ ਸੂਚੀ ਵਿੱਚੋਂ ਹਟਾਉਣਾ ਚਾਹੁੰਦੇ ਹੋ? ਇਹ ਇਤਿਹਾਸਿਕ ਲੇਜਰਾਂ ਨੂੰ ਪ੍ਰਭਾਵਿਤ ਨਹੀਂ ਕਰੇਗਾ।`}
        confirmLabel="ਮਿਟਾਓ (Delete)"
        cancelLabel="ਰੱਦ ਕਰੋ (Cancel)"
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            const res = await deleteCustomerAction(deleteTarget.id);
            if (res && 'error' in res) {
              showToast(res.error || 'Error deleting customer', 'error');
              return;
            }
            showToast('Customer deleted ✓', 'success');
            router.refresh();
          } catch (err: any) {
            showToast(err.message || 'Error deleting customer', 'error');
          } finally {
            setDeleteTarget(null);
          }
        }}
        onClose={() => setDeleteTarget(null)}
        isDestructive={true}
      />
    </div>
  );
}
