'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { expenseSchema } from '../../validation';
import { useTranslation } from '../../hooks/useTranslation';
import { createExpenseAction, listExpensesAction, getExpenseSummaryAction } from '../../lib/actions/expenses';
import { ExpenseCategory } from '@prisma/client';
import { z } from 'zod';
import { Plus, Receipt, Landmark, Zap, Truck, HelpCircle, X } from 'lucide-react';

type ExpenseInputs = z.infer<typeof expenseSchema>;

interface ExpensesClientProps {
  expensesData: {
    items: any[];
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
  summary: {
    category: ExpenseCategory;
    totalAmount: number;
  }[];
}

export default function ExpensesClient({ expensesData, summary }: ExpensesClientProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<any[]>(expensesData.items);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: 'MISC',
      amount: 0,
      description: '',
    },
  });

  const onExpenseSubmit = async (data: ExpenseInputs) => {
    setLoading(true);
    try {
      const res = await createExpenseAction(data);
      if (res.success) {
        setIsOpen(false);
        reset();
        
        // Refresh local listing
        const freshData = await listExpensesAction(1, 20);
        setExpenses(freshData.items);
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save expense');
    } finally {
      setLoading(false);
    }
  };

  // Map category to icons and colors
  const categoryConfig = {
    RENT: { label: t('categoryRent'), icon: Landmark, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/20' },
    SALARY: { label: t('categorySalary'), icon: Receipt, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/20' },
    ELECTRICITY: { label: t('categoryElectricity'), icon: Zap, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/20' },
    TRANSPORT: { label: t('categoryTransport'), icon: Truck, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' },
    MISC: { label: t('categoryMisc'), icon: HelpCircle, color: 'text-slate-500 bg-slate-50 dark:bg-slate-900/50' },
  };

  return (
    <div className="space-y-6">
      
      {/* Category Summaries Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {(Object.keys(categoryConfig) as ExpenseCategory[]).map((cat) => {
          const config = categoryConfig[cat];
          const Icon = config.icon;
          const totalVal = summary.find((s) => s.category === cat)?.totalAmount || 0;

          return (
            <div
              key={cat}
              className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-205 dark:border-slate-800 shadow-sm flex flex-col justify-between"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-slate-500 truncate" title={config.label}>
                  {config.label}
                </span>
                <div className={`p-1.5 rounded-lg ${config.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-lg font-extrabold tracking-tight mt-3">
                ₹{totalVal.toLocaleString('en-IN')}
              </p>
            </div>
          );
        })}
      </div>

      {/* Title block with trigger button */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-md font-bold">ਖਰਚਿਆਂ ਦੀ ਸੂਚੀ (Expense Records)</h3>
        <button
          onClick={() => setIsOpen(true)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow flex items-center gap-1.5"
        >
          <Plus className="w-5 h-5" />
          ਖਰਚਾ ਦਰਜ ਕਰੋ (Add Expense)
        </button>
      </div>

      {/* Expense List Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-900/50">
                <th className="py-4 px-6">{t('expenseDate')}</th>
                <th className="py-4 px-6">{t('expenseCategory')}</th>
                <th className="py-4 px-6">{t('description')}</th>
                <th className="py-4 px-6 text-right">{t('expenseAmount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-400 font-semibold">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-6">
                      {new Date(exp.date).toLocaleDateString('en-IN', {
                        dateStyle: 'medium',
                      })}
                    </td>
                    <td className="py-3.5 px-6">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                        categoryConfig[exp.category as ExpenseCategory]?.color || ''
                      }`}>
                        {categoryConfig[exp.category as ExpenseCategory]?.label || exp.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-slate-500 dark:text-slate-400 max-w-sm truncate">
                      {exp.description || '-'}
                    </td>
                    <td className="py-3.5 px-6 text-right font-extrabold text-rose-600">
                      ₹{Number(exp.amount).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD EXPENSE MODAL */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-500" />
                ਨਵਾਂ ਖਰਚਾ ਦਰਜ ਕਰੋ (Log Shop Expense)
              </h2>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onExpenseSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t('expenseCategory')}
                </label>
                <select
                  {...register('category')}
                  className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-bold"
                >
                  <option value="RENT">{t('categoryRent')}</option>
                  <option value="SALARY">{t('categorySalary')}</option>
                  <option value="ELECTRICITY">{t('categoryElectricity')}</option>
                  <option value="TRANSPORT">{t('categoryTransport')}</option>
                  <option value="MISC">{t('categoryMisc')}</option>
                </select>
                {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t('expenseAmount')} (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  {...register('amount')}
                  className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-lg font-bold text-rose-650"
                  placeholder="0.00"
                />
                {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t('description')} (ਵੇਰਵਾ)
                </label>
                <input
                  type="text"
                  {...register('description')}
                  className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm"
                  placeholder="e.g. Paid cash for light bill"
                />
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
                  disabled={loading}
                  className="px-5 py-2.5 bg-blue-650 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow disabled:opacity-50"
                >
                  {loading ? 'ਦਰਜ ਹੋ ਰਿਹਾ ਹੈ...' : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
