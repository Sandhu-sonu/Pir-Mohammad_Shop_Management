'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { closingSchema } from '@/validation';
import { saveClosingAction, reverseClosingAction } from '@/lib/actions/closing';
import { createBackupAction } from '@/lib/actions/backups';
import { useTranslation } from '@/hooks/useTranslation';
import { z } from 'zod';
import { CheckCircle, AlertTriangle, ArrowLeft, ArrowRight, Save, RotateCcw } from 'lucide-react';
import Link from 'next/link';

type ClosingInputs = z.infer<typeof closingSchema>;

interface ClosingFormProps {
  metrics: {
    suggestedOpeningCash: number;
    salesCash: number;
    salesUpi: number;
    paymentsReceivedCash: number;
    paymentsReceivedUpi: number;
    expensesCash: number;
    expensesUpi: number;
    supplierPaymentsCash: number;
    supplierPaymentsUpi: number;
  };
  existingClosing: any;
  dateString: string;
  currentUserId: string;
  currentUserRole: string;
}

export default function ClosingForm({
  metrics,
  existingClosing,
  dateString,
  currentUserId,
  currentUserRole,
}: ClosingFormProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [showReversalModal, setShowReversalModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isAlreadyLocked = existingClosing && existingClosing.isLocked && !existingClosing.isReversed;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(closingSchema),
    defaultValues: {
      openingCash: isAlreadyLocked ? Number(existingClosing.openingCash) : metrics.suggestedOpeningCash,
      closingCash: isAlreadyLocked ? Number(existingClosing.closingCash) : 0,
      withdrawals: isAlreadyLocked ? Number(existingClosing.withdrawals) : 0,
      notes: isAlreadyLocked ? existingClosing.notes || '' : '',
      staffSignature: isAlreadyLocked ? existingClosing.staffSignature || '' : '',
      ownerSignature: isAlreadyLocked ? existingClosing.ownerSignature || '' : '',
    },
  });

  const watchOpening = watch('openingCash') || 0;
  const watchClosing = watch('closingCash') || 0;
  const watchWithdrawals = watch('withdrawals') || 0;

  // Expected Cash = Opening Cash + Cash Sales + Cash Recoveries - Cash Expenses - Supplier Payments (Cash) - Withdrawals
  const expectedCash =
    Number(watchOpening) +
    metrics.salesCash +
    metrics.paymentsReceivedCash -
    metrics.expensesCash -
    metrics.supplierPaymentsCash -
    Number(watchWithdrawals);

  const difference = Number(watchClosing) - expectedCash;

  const onSubmit = async (data: any) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await saveClosingAction({
        dateString,
        openingCash: data.openingCash,
        closingCash: data.closingCash,
        withdrawals: data.withdrawals,
        notes: data.notes,
        staffSignature: data.staffSignature,
        staffUserId: currentUserRole === 'STAFF' ? currentUserId : undefined,
        ownerSignature: data.ownerSignature,
        ownerUserId: currentUserRole === 'OWNER' || currentUserRole === 'MANAGER' ? currentUserId : undefined,
      });
      if (res.success) {
        try {
          const backupRes = await createBackupAction('Automatic backup after daily closing lock');
          if (!backupRes.success) {
            alert('Warning (ਚੇਤਾਵਨੀ): Auto backup failed. Daily closing has been saved but data was not backed up.');
          }
        } catch (backupErr) {
          console.error('Auto backup failed:', backupErr);
          alert('Warning (ਚੇਤਾਵਨੀ): Auto backup failed. Daily closing has been saved.');
        }
        window.location.reload();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to save daily closing.');
    } finally {
      setLoading(false);
    }
  };

  const handleReverse = async () => {
    if (!reversalReason.trim()) {
      alert('Please enter a reason for reversal.');
      return;
    }
    setLoading(true);
    try {
      const res = await reverseClosingAction(existingClosing.id, reversalReason);
      if (res.success) {
        window.location.reload();
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to reverse daily closing.');
    } finally {
      setLoading(false);
      setShowReversalModal(false);
    }
  };

  // If daily closing is already locked and active
  if (isAlreadyLocked) {
    const DC = existingClosing;
    const diff = Number(DC.difference);
    let statusText = 'MATCHED (ਮੇਲ ਖਾਂਦਾ)';
    let statusColor = 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-450 border-emerald-500';
    if (diff < 0) {
      statusText = 'SHORTAGE (ਨਕਦ ਘਾਟ)';
      statusColor = 'bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:text-rose-450 border-rose-500';
    } else if (diff > 0) {
      statusText = 'EXCESS (ਵਾਧੂ ਨਕਦ)';
      statusColor = 'bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-450 border-amber-500';
    }

    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Locked Register</span>
            <h2 className="text-xl font-extrabold mt-1">ਕਲੋਜ਼ਿੰਗ ਮੁਕੰਮਲ ਹੈ (Business Closed Today)</h2>
          </div>
          <span className="px-3 py-1 bg-zinc-150 dark:bg-zinc-800 text-xs font-bold rounded-lg">
            {new Date(DC.date).toLocaleDateString()}
          </span>
        </div>

        <div className={`p-4 rounded-xl border flex items-center justify-between font-bold ${statusColor}`}>
          <span>ਸਥਿਤੀ (Status): {statusText}</span>
          <span className="text-lg">₹{diff.toFixed(2)}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-3 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-zinc-500">Cash Summary</h3>
            <div className="flex justify-between">
              <span>ਸ਼ੁਰੂਆਤੀ ਨਕਦ (Opening Cash):</span>
              <span className="font-bold">₹{Number(DC.openingCash).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>ਨਕਦ ਵਿਕਰੀ (Cash Sales):</span>
              <span className="font-bold">₹{Number(DC.salesCash).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>ਗਾਹਕਾਂ ਤੋਂ ਵਸੂਲੀ (Customer Recoveries):</span>
              <span className="font-bold">₹{Number(DC.paymentsReceivedCash).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-rose-500">
              <span>(-) ਨਕਦ ਖਰਚੇ (Expenses paid Cash):</span>
              <span className="font-bold">- ₹{Number(DC.expensesCash).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-rose-500">
              <span>(-) ਸਪਲਾਇਰ ਭੁਗਤਾਨ (Supplier Payments Cash):</span>
              <span className="font-bold">- ₹{Number(DC.supplierPaymentsCash).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-rose-500">
              <span>(-) ਨਕਦ ਨਿਕਾਸੀ (Cash Withdrawals):</span>
              <span className="font-bold">- ₹{Number(DC.withdrawals).toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-3 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-zinc-500">Verification & Signatures</h3>
            <div className="flex justify-between">
              <span>ਅਨੁਮਾਨਿਤ ਰਾਸ਼ੀ (Expected Cash):</span>
              <span className="font-bold">₹{(Number(DC.openingCash) + Number(DC.salesCash) + Number(DC.paymentsReceivedCash) - Number(DC.expensesCash) - Number(DC.supplierPaymentsCash) - Number(DC.withdrawals)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-800 pt-2 font-bold text-indigo-600 dark:text-indigo-400">
              <span>ਗੱਲੇ ਵਿੱਚ ਰਾਸ਼ੀ (Actual Cash Count):</span>
              <span>₹{Number(DC.closingCash).toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
              <p className="text-xs"><strong>Staff Signature:</strong> {DC.staffSignature || 'N/A'}</p>
              <p className="text-xs"><strong>Owner/Manager Signature:</strong> {DC.ownerSignature || 'N/A'}</p>
              <p className="text-xs"><strong>Closed By:</strong> {DC.user?.name || 'System'}</p>
            </div>
          </div>
        </div>

        {DC.notes && (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-150 dark:border-zinc-850 text-xs">
            <strong>Notes / Comments:</strong>
            <p className="mt-1 text-zinc-650 dark:text-zinc-400">{DC.notes}</p>
          </div>
        )}

        {/* Reversal trigger for Owner/Manager */}
        {(currentUserRole === 'OWNER' || currentUserRole === 'MANAGER') && (
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 flex justify-end">
            <button
              onClick={() => setShowReversalModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 dark:text-rose-455 font-bold text-xs rounded-xl transition duration-200"
            >
              <RotateCcw className="w-4 h-4" />
              ਕਲੋਜ਼ਿੰਗ ਰਿਵਰਸ ਕਰੋ (Reverse Daily Closing)
            </button>
          </div>
        )}

        {/* Reversal Confirmation Modal */}
        {showReversalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4">
              <h3 className="text-lg font-black text-zinc-900 dark:text-white">Confirm Closing Reversal</h3>
              <p className="text-xs text-zinc-550 dark:text-zinc-400">
                Reversing this daily closing will unlock today's transactions and allow adjustments. This action is auditable.
              </p>
              <textarea
                placeholder="Enter reason for reversal (ਲਾਜ਼ਮੀ ਕਾਰਨ)..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                className="w-full text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3"
                rows={3}
                required
              />
              <div className="flex justify-end gap-2 text-xs font-bold">
                <button
                  onClick={() => setShowReversalModal(false)}
                  className="px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReverse}
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

  // Step-by-Step interactive closing wizard (if active and not locked)
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6">
      {/* Steps indicator */}
      <div className="flex items-center justify-between mb-8 border-b border-zinc-100 dark:border-zinc-850 pb-4">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-850"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="text-xs font-bold text-zinc-450 dark:text-zinc-500">Back</span>
        </div>

        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => step > s && setStep(s)}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                step === s
                  ? 'bg-indigo-600 text-white scale-110 shadow-md shadow-indigo-600/25'
                  : step > s
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-450 cursor-pointer'
                  : 'bg-zinc-100 text-zinc-450 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 bg-rose-50 dark:bg-rose-950/20 border border-rose-500 text-rose-800 dark:text-rose-400 p-4 rounded-xl flex items-center gap-3 text-xs font-bold">
          <AlertTriangle className="w-5 h-5" />
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* STEP 1: INFLOWS */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Step 1 of 3</span>
              <h2 className="text-xl font-black mt-1">ਨਕਦ ਪ੍ਰਵਾਹ (Cash Inflows)</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Define opening cash and verify today's transactions.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-350 uppercase">
                  {t('openingCash')} (ਸਵੇਰ ਦਾ ਗੱਲਾ - ₹)
                </label>
                <input
                  type="number"
                  step="any"
                  {...register('openingCash')}
                  className="mt-2 w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl text-lg font-black tracking-tight focus:ring-2 focus:ring-indigo-600 dark:text-white"
                />
                {errors.openingCash && (
                  <p className="mt-1 text-xs text-red-500">{String(errors.openingCash.message)}</p>
                )}
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 rounded-xl p-4 space-y-2 border border-zinc-150 dark:border-zinc-850 text-xs">
              <h3 className="font-extrabold uppercase text-[10px] tracking-wider text-zinc-450">Today's System Cash Inflows</h3>
              <div className="flex justify-between">
                <span>ਅੱਜ ਦੀ ਨਕਦ ਵਿਕਰੀ (Cash Sales today):</span>
                <span className="font-bold">₹{metrics.salesCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>ਗਾਹਕਾਂ ਤੋਂ ਨਕਦ ਵਸੂਲੀ (Khata recoveries today):</span>
                <span className="font-bold">₹{metrics.paymentsReceivedCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-800 pt-2 font-bold text-indigo-600 dark:text-indigo-400">
                <span>Total Cash Inflow:</span>
                <span>₹{(Number(watchOpening) + metrics.salesCash + metrics.paymentsReceivedCash).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition-all"
              >
                Next Outflows
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: OUTFLOWS */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Step 2 of 3</span>
              <h2 className="text-xl font-black mt-1">ਨਕਦ ਨਿਕਾਸੀ (Cash Outflows)</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Verify expenses, supplier payments, and withdrawals.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-350 uppercase">
                  ਨਕਦ ਨਿਕਾਸੀ (Cash Withdrawals/Ondraw - ₹)
                </label>
                <input
                  type="number"
                  step="any"
                  {...register('withdrawals')}
                  className="mt-2 w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl text-lg font-black tracking-tight focus:ring-2 focus:ring-indigo-600 dark:text-white"
                />
                {errors.withdrawals && (
                  <p className="mt-1 text-xs text-red-500">{String(errors.withdrawals.message)}</p>
                )}
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 rounded-xl p-4 space-y-2 border border-zinc-150 dark:border-zinc-850 text-xs">
              <h3 className="font-extrabold uppercase text-[10px] tracking-wider text-zinc-450">Today's System Cash Outflows</h3>
              <div className="flex justify-between">
                <span>ਅੱਜ ਦੇ ਨਕਦ ਖਰਚੇ (Cash Expenses today):</span>
                <span className="font-bold">₹{metrics.expensesCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>ਸਪਲਾਇਰਾਂ ਨੂੰ ਭੁਗਤਾਨ (Supplier payments Cash):</span>
                <span className="font-bold">₹{metrics.supplierPaymentsCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-800 pt-2 font-bold text-rose-500">
                <span>Total Cash Outflow (Inc. Withdrawals):</span>
                <span>₹{(metrics.expensesCash + metrics.supplierPaymentsCash + Number(watchWithdrawals)).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-6 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs hover:bg-zinc-50 dark:hover:bg-zinc-850 transition"
              >
                Back Inflows
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition-all"
              >
                Next Reconciliation
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: RECONCILIATION */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Step 3 of 3</span>
              <h2 className="text-xl font-black mt-1">ਮੇਲ-ਜੋਲ ਅਤੇ ਤਾਲਾਬੰਦੀ (Reconciliation & Close)</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Input physical count, sign, and close today's register.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-350 uppercase">
                  {t('closingCash')} (ਗੱਲੇ ਵਿੱਚ ਅਸਲ ਰਾਸ਼ੀ - ₹)
                </label>
                <input
                  type="number"
                  step="any"
                  {...register('closingCash')}
                  className="mt-2 w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl text-lg font-black tracking-tight focus:ring-2 focus:ring-indigo-600 dark:text-white"
                />
                {errors.closingCash && (
                  <p className="mt-1 text-xs text-red-500">{String(errors.closingCash.message)}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-350 uppercase">
                  Expected Cash in Hand (ਅਨੁਮਾਨਿਤ ਰਾਸ਼ੀ)
                </label>
                <div className="mt-2 w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-850 border border-transparent rounded-xl text-lg font-black text-zinc-600 dark:text-zinc-400">
                  ₹{expectedCash.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Difference Status bar */}
            <div className={`p-4 rounded-xl border flex items-center justify-between font-bold text-md ${
              difference === 0
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-800 dark:text-emerald-400'
                : difference < 0
                ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-500 text-rose-800 dark:text-rose-450'
                : 'bg-amber-50 dark:bg-amber-950/20 border-amber-500 text-amber-800 dark:text-amber-450'
            }`}>
              <div className="flex items-center gap-2">
                {difference !== 0 && <AlertTriangle className="w-5 h-5 animate-pulse" />}
                <span>
                  {difference === 0 ? 'Matched (ਕੋਈ ਫਰਕ ਨਹੀਂ)' : difference < 0 ? 'Shortage (ਨਕਦ ਘਾਟ)' : 'Excess (ਵਾਧੂ ਨਕਦ)'}
                </span>
              </div>
              <span>
                {difference > 0 ? '+' : ''} ₹{difference.toFixed(2)}
              </span>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-350 uppercase">
                  Staff Signature (ਸਟਾਫ ਦੇ ਦਸਤਖਤ)
                </label>
                <input
                  type="text"
                  placeholder="Enter staff name..."
                  {...register('staffSignature')}
                  className="mt-2 w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl text-xs focus:ring-2 focus:ring-indigo-600 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-350 uppercase">
                  Owner/Manager Signature (ਮਾਲਕ ਦੇ ਦਸਤਖਤ)
                </label>
                <input
                  type="text"
                  placeholder="Enter owner/manager name..."
                  {...register('ownerSignature')}
                  className="mt-2 w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl text-xs focus:ring-2 focus:ring-indigo-600 dark:text-white"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-350 uppercase">
                {t('notes')} (ਕਲੋਜ਼ਿੰਗ ਟਿੱਪਣੀ)
              </label>
              <textarea
                {...register('notes')}
                className="mt-2 w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl text-xs"
                rows={3}
                placeholder="Provide notes if there is a shortage/excess..."
              />
            </div>

            <div className="flex justify-between pt-4 border-t border-zinc-150 dark:border-zinc-850">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs hover:bg-zinc-50 dark:hover:bg-zinc-850 transition"
              >
                Back Outflows
              </button>
              
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-600/25 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {loading ? 'ਦਰਜ ਹੋ ਰਿਹਾ ਹੈ...' : 'ਕਲੋਜ਼ਿੰਗ ਲਾਕ ਕਰੋ (Lock Daily Closing)'}
              </button>
            </div>
          </div>
        )}

      </form>
    </div>
  );
}
