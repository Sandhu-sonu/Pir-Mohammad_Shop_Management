'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { expenseSchema } from '../../validation';
import { useTranslation } from '../../hooks/useTranslation';
import { createExpenseAction, updateExpenseAction, reverseExpenseAction, listExpensesAction } from '../../lib/actions/expenses';
import { PaymentMethod } from '@prisma/client';
import { z } from 'zod';
import { Plus, Receipt, Landmark, Zap, Truck, HelpCircle, X, Edit, RotateCcw, Download, Calendar, Coins } from 'lucide-react';

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
    category: string;
    totalAmount: number;
  }[];
  currentUserRole: string;
  currentUserId: string;
}

export default function ExpensesClient({
  expensesData,
  summary,
  currentUserRole,
  currentUserId,
}: ExpensesClientProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<any[]>(expensesData.items);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(expensesData.pages);

  // Custom category state
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');

  // Reversal state
  const [showReversalModal, setShowReversalModal] = useState(false);
  const [reversalId, setReversalId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  const canManage = currentUserRole === 'OWNER' || currentUserRole === 'MANAGER';

  const defaultCategories = [
    { value: 'Salary', label: 'ਤਨਖਾਹ (Salary)' },
    { value: 'Rent', label: 'ਕਿਰਾਇਆ (Rent)' },
    { value: 'Electricity', label: 'ਬਿਜਲੀ (Electricity)' },
    { value: 'Internet', label: 'ਇੰਟਰਨੈੱਟ (Internet)' },
    { value: 'Transport', label: 'ਕਿਰਾਇਆ/ਟਰਾਂਸਪੋਰਟ (Transport)' },
    { value: 'Tea & Refreshments', label: 'ਚਾਹ ਅਤੇ ਰਿਫ੍ਰੈਸ਼ਮੈਂਟ (Tea & Refreshments)' },
    { value: 'Shop Maintenance', label: 'ਦੁਕਾਨ ਦੀ ਮੁਰੰਮਤ (Shop Maintenance)' },
    { value: 'Stationery', label: 'ਸਟੇਸ਼ਨਰੀ (Stationery)' },
    { value: 'Miscellaneous', label: 'ਫੁਟਕਲ (Miscellaneous)' },
  ];

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: 'Miscellaneous',
      amount: 0,
      description: '',
      paymentMethod: 'CASH' as PaymentMethod,
      notes: '',
      date: new Date().toISOString().slice(0, 10),
    },
  });

  const watchedCategory = watch('category');
  const watchedAmount = watch('amount');
  const watchedDescription = watch('description');
  const watchedPaymentMethod = watch('paymentMethod');
  const watchedNotes = watch('notes');
  const watchedDate = watch('date');

  useEffect(() => {
    // Auto-save form drafts if any fields are modified from default
    if (Number(watchedAmount) > 0 || watchedDescription || watchedNotes) {
      localStorage.setItem('draft_expense_form', JSON.stringify({
        category: watchedCategory,
        amount: watchedAmount,
        description: watchedDescription,
        paymentMethod: watchedPaymentMethod,
        notes: watchedNotes,
        date: watchedDate,
        savedAt: Date.now()
      }));
    } else {
      localStorage.removeItem('draft_expense_form');
    }
  }, [watchedCategory, watchedAmount, watchedDescription, watchedPaymentMethod, watchedNotes, watchedDate]);

  useEffect(() => {
    const approved = localStorage.getItem('draft_restore_approved');
    if (approved === 'true') {
      const draft = localStorage.getItem('draft_expense_form');
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          const now = Date.now();
          if (parsed.savedAt && now - parsed.savedAt <= 24 * 60 * 60 * 1000) {
            if (parsed.category) setValue('category', parsed.category);
            if (parsed.amount) setValue('amount', Number(parsed.amount));
            if (parsed.description) setValue('description', parsed.description);
            if (parsed.paymentMethod) setValue('paymentMethod', parsed.paymentMethod);
            if (parsed.notes) setValue('notes', parsed.notes);
            if (parsed.date) setValue('date', parsed.date);
            setIsOpen(true); // Open the modal form automatically
          }
        } catch (e) {
          console.error('Failed to restore expense draft', e);
        }
      }
    }
  }, []);

  const onExpenseSubmit = async (data: ExpenseInputs) => {
    setLoading(true);
    try {
      const finalCategory = isCustomCategory ? customCategoryName.trim() : data.category;
      if (isCustomCategory && !finalCategory) {
        alert('Please enter a custom category name.');
        setLoading(false);
        return;
      }

      let res;
      if (isEditing && editingId) {
        res = await updateExpenseAction(editingId, {
          category: finalCategory,
          amount: data.amount,
          description: data.description,
          paymentMethod: data.paymentMethod as PaymentMethod,
          notes: data.notes,
          date: data.date,
        });
      } else {
        res = await createExpenseAction({
          category: finalCategory,
          amount: data.amount,
          description: data.description,
          paymentMethod: data.paymentMethod as PaymentMethod,
          notes: data.notes,
          date: data.date,
        });
      }

      if (res.success) {
        setIsOpen(false);
        setIsEditing(false);
        setEditingId(null);
        setIsCustomCategory(false);
        setCustomCategoryName('');
        reset();
        localStorage.removeItem('draft_expense_form');
        
        // Refresh local listing
        const freshData = await listExpensesAction(page, 20);
        setExpenses(freshData.items);
        setTotalPages(freshData.pages);
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save expense');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (exp: any) => {
    setIsEditing(true);
    setEditingId(exp.id);
    
    // Check if category is custom
    const isDefault = defaultCategories.some(cat => cat.value === exp.category);
    if (isDefault) {
      setIsCustomCategory(false);
      setValue('category', exp.category);
    } else {
      setIsCustomCategory(true);
      setValue('category', 'CUSTOM');
      setCustomCategoryName(exp.category);
    }

    setValue('amount', Number(exp.amount));
    setValue('description', exp.description || '');
    setValue('paymentMethod', exp.paymentMethod);
    setValue('notes', exp.notes || '');
    setValue('date', new Date(exp.date).toISOString().slice(0, 10));
    setIsOpen(true);
  };

  const handleReverseClick = (id: string) => {
    setReversalId(id);
    setReversalReason('');
    setShowReversalModal(true);
  };

  const submitReversal = async () => {
    if (!reversalId || !reversalReason.trim()) return;
    setLoading(true);
    try {
      const res = await reverseExpenseAction(reversalId, reversalReason);
      if (res.success) {
        setShowReversalModal(false);
        const freshData = await listExpensesAction(page, 20);
        setExpenses(freshData.items);
        setTotalPages(freshData.pages);
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to reverse expense');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (expenses.length === 0) return;
    
    const headers = ['Date', 'Category', 'Amount', 'Payment Method', 'Description', 'Notes', 'Created By', 'Status', 'Reversal Reason'];
    const rows = expenses.map(exp => [
      new Date(exp.date).toLocaleDateString(),
      exp.category,
      exp.amount,
      exp.paymentMethod,
      exp.description || '',
      exp.notes || '',
      exp.user?.name || 'System',
      exp.isReversed ? 'REVERSED' : 'ACTIVE',
      exp.reversalReason || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Expenses_Export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Map category to icons and colors
  const getCategoryConfig = (cat: string) => {
    const norm = cat.toLowerCase();
    if (norm.includes('rent')) return { label: 'ਕਿਰਾਇਆ (Rent)', icon: Landmark, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/20 border-blue-200' };
    if (norm.includes('salary') || norm.includes('labour')) return { label: 'ਤਨਖਾਹ (Salary)', icon: Receipt, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/20 border-purple-200' };
    if (norm.includes('electricity') || norm.includes('power')) return { label: 'ਬਿਜਲੀ (Electricity)', icon: Zap, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/20 border-amber-200' };
    if (norm.includes('transport') || norm.includes('courier') || norm.includes('fare')) return { label: 'ਟਰਾਂਸਪੋਰਟ (Transport)', icon: Truck, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200' };
    if (norm.includes('tea') || norm.includes('refresh')) return { label: 'ਚਾਹ/ਪਾਣੀ (Tea & Refreshments)', icon: Coins, color: 'text-orange-500 bg-orange-50 dark:bg-orange-950/20 border-orange-200' };
    return { label: cat, icon: HelpCircle, color: 'text-slate-500 bg-slate-50 dark:bg-slate-900/50 border-slate-200' };
  };

  return (
    <div className="space-y-6">
      
      {/* Category Summaries Grid (Only visible to Owner/Manager) */}
      {summary && summary.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {summary.slice(0, 5).map((s) => {
            const config = getCategoryConfig(s.category);
            const Icon = config.icon;

            return (
              <div
                key={s.category}
                className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between"
              >
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-zinc-500 truncate" title={config.label}>
                    {config.label}
                  </span>
                  <div className={`p-1.5 rounded-lg ${config.color.split(' ')[0]} ${config.color.split(' ')[1]}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-lg font-black tracking-tight mt-3">
                  ₹{s.totalAmount.toLocaleString('en-IN')}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Header */}
      <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">ਖਰਚਿਆਂ ਦੀ ਸੂਚੀ (Expense Records)</h3>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            disabled={expenses.length === 0}
            className="px-4 py-2 border border-zinc-250 dark:border-zinc-800 text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-850 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            CSV Export
          </button>
          
          {currentUserRole !== 'VIEW_ONLY' && (
            <button
              onClick={() => {
                setIsEditing(false);
                setEditingId(null);
                setIsCustomCategory(false);
                reset();
                setIsOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              ਖਰਚਾ ਦਰਜ ਕਰੋ (Add Expense)
            </button>
          )}
        </div>
      </div>

      {/* Expense List Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider bg-zinc-50 dark:bg-zinc-850/50">
                <th className="py-4 px-6">Date</th>
                <th className="py-4 px-6">Category</th>
                <th className="py-4 px-6">Payment Method</th>
                <th className="py-4 px-6">Description</th>
                <th className="py-4 px-6">Notes</th>
                <th className="py-4 px-6">Created By</th>
                <th className="py-4 px-6 text-right">Amount</th>
                {canManage && <th className="py-4 px-6 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-zinc-400 font-bold">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr
                    key={exp.id}
                    className={`hover:bg-zinc-50 dark:hover:bg-zinc-850/20 transition-colors ${
                      exp.isReversed ? 'bg-red-50/20 dark:bg-red-950/10 text-zinc-400 line-through' : ''
                    }`}
                  >
                    <td className="py-3.5 px-6">
                      {new Date(exp.date).toLocaleDateString('en-IN', {
                        dateStyle: 'medium',
                      })}
                    </td>
                    <td className="py-3.5 px-6">
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                        getCategoryConfig(exp.category).color.split(' ')[0]
                      } ${getCategoryConfig(exp.category).color.split(' ')[1]}`}>
                        {getCategoryConfig(exp.category).label}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 font-semibold uppercase">{exp.paymentMethod}</td>
                    <td className="py-3.5 px-6 max-w-xs truncate">{exp.description || '-'}</td>
                    <td className="py-3.5 px-6 max-w-xs truncate">{exp.notes || '-'}</td>
                    <td className="py-3.5 px-6">{exp.user?.name || 'System'}</td>
                    <td className="py-3.5 px-6 text-right font-extrabold text-rose-600">
                      ₹{Number(exp.amount).toFixed(2)}
                    </td>
                    {canManage && (
                      <td className="py-3.5 px-6 text-center space-x-1.5">
                        {!exp.isReversed && (
                          <>
                            <button
                              onClick={() => handleEditClick(exp)}
                              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-indigo-650 rounded-lg"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReverseClick(exp.id)}
                              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-rose-600 rounded-lg"
                              title="Reverse"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {exp.isReversed && (
                          <span className="text-[10px] text-red-550 font-bold">Reversed</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT EXPENSE MODAL */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-lg font-black flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-500" />
                {isEditing ? 'ਖਰਚਾ ਸੋਧੋ (Edit Shop Expense)' : 'ਨਵਾਂ ਖਰਚਾ ਦਰਜ ਕਰੋ (Log Shop Expense)'}
              </h2>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onExpenseSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                  {t('expenseCategory')}
                </label>
                <select
                  {...register('category')}
                  onChange={(e) => setIsCustomCategory(e.target.value === 'CUSTOM')}
                  className="mt-1.5 w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold"
                >
                  {defaultCategories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                  <option value="CUSTOM">ਹੋਰ (Custom Category)...</option>
                </select>
              </div>

              {isCustomCategory && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Custom Category Name (ਖਰਚੇ ਦਾ ਨਾਮ)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter custom category name..."
                    value={customCategoryName}
                    onChange={(e) => setCustomCategoryName(e.target.value)}
                    className="mt-1.5 w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Payment Method
                  </label>
                  <select
                    {...register('paymentMethod')}
                    className="mt-1.5 w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold"
                  >
                    <option value="CASH">Cash (ਨਕਦ)</option>
                    <option value="UPI">UPI (ਗੂਗਲ ਪੇ/ਪੇਟੀਐਮ)</option>
                    <option value="BANK_TRANSFER">Bank Transfer (ਬੈਂਕ ਟ੍ਰਾਂਸਫਰ)</option>
                    <option value="CARD">Card (ਕਾਰਡ)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Expense Date
                  </label>
                  <input
                    type="date"
                    {...register('date')}
                    className="mt-1.5 w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                  {t('expenseAmount')} (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  {...register('amount')}
                  className="mt-1.5 w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-lg font-black text-rose-650"
                  placeholder="0.00"
                />
                {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                  {t('description')} (ਵੇਰਵਾ)
                </label>
                <input
                  type="text"
                  {...register('description')}
                  className="mt-1.5 w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs"
                  placeholder="e.g. Paid cash for light bill"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Notes (ਟਿੱਪਣੀ)
                </label>
                <textarea
                  {...register('notes')}
                  className="mt-1.5 w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs"
                  rows={2}
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-zinc-150 dark:border-zinc-800 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-5 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow disabled:opacity-50"
                >
                  {loading ? 'ਦਰਜ ਹੋ ਰਿਹਾ ਹੈ...' : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVERSAL MODAL */}
      {showReversalModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h2 className="text-lg font-black text-zinc-900 dark:text-white">Confirm Expense Reversal</h2>
            <p className="text-xs text-zinc-550 dark:text-zinc-400">
              Reversing this expense will remove it from all financial profit engine calculations. This action is irreversible.
            </p>
            
            <textarea
              placeholder="Enter reason for reversal (ਲਾਜ਼ਮੀ ਕਾਰਨ)..."
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              className="w-full text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3"
              rows={3}
              required
            />

            <div className="flex gap-3 justify-end pt-4 border-t border-zinc-150 dark:border-zinc-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setShowReversalModal(false)}
                className="px-4 py-2 hover:bg-zinc-150 dark:hover:bg-zinc-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReversal}
                disabled={loading || !reversalReason.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl disabled:opacity-50"
              >
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
