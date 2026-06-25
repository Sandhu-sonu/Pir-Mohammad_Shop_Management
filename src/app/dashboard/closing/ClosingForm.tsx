'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { closingSchema } from '../../../validation';
import { saveClosingAction } from '../../../lib/actions/closing';
import { useTranslation } from '../../../hooks/useTranslation';
import { z } from 'zod';
import { CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
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
  };
  existingClosing: any;
  dateString: string;
}

export default function ClosingForm({ metrics, existingClosing, dateString }: ClosingFormProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(closingSchema),
    defaultValues: {
      openingCash: existingClosing ? Number(existingClosing.openingCash) : metrics.suggestedOpeningCash,
      closingCash: existingClosing ? Number(existingClosing.closingCash) : 0,
      notes: existingClosing ? existingClosing.notes || '' : '',
    },
  });

  const watchOpening = watch('openingCash') || 0;
  const watchClosing = watch('closingCash') || 0;

  // Expected Cash = Opening Cash + Cash Sales + Cash Payments Received - Cash Expenses
  const expectedCash = 
    Number(watchOpening) + 
    metrics.salesCash + 
    metrics.paymentsReceivedCash - 
    metrics.expensesCash;

  const difference = Number(watchClosing) - expectedCash;

  const onSubmit = async (data: ClosingInputs) => {
    setLoading(true);
    try {
      const res = await saveClosingAction({
        dateString,
        openingCash: data.openingCash,
        closingCash: data.closingCash,
        notes: data.notes,
      });
      if (res.success) {
        setSuccess(true);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save daily closing.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden p-6">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/dashboard" className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-850">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="text-sm font-semibold text-slate-500">Back to Dashboard</span>
      </div>

      {success && (
        <div className="mb-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500 text-emerald-800 dark:text-emerald-350 p-4 rounded-xl flex items-center gap-3 font-semibold">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          ਰੋਜ਼ਾਨਾ ਕਲੋਜ਼ਿੰਗ ਸਫਲਤਾਪੂਰਵਕ ਸੇਵ ਹੋ ਗਈ ਹੈ (Daily closing saved successfully!)
        </div>
      )}

      {existingClosing && !success && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-950/20 border border-blue-500 text-blue-800 dark:text-blue-350 p-4 rounded-xl flex items-center gap-3 font-medium">
          <CheckCircle className="w-5 h-5 text-blue-500" />
          ਤੁਸੀਂ ਅੱਜ ਦੀ ਕਲੋਜ਼ਿੰਗ ਪਹਿਲਾਂ ਹੀ ਦਰਜ ਕਰ ਚੁੱਕੇ ਹੋ। ਤੁਸੀਂ ਇਸ ਨੂੰ ਅਪਡੇਟ ਕਰ ਸਕਦੇ ਹੋ (Already closed for today. You can update it below).
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Opening Cash Input */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
              {t('openingCash')} (ਸਵੇਰ ਦਾ ਗੱਲਾ - ₹)
            </label>
            <input
              type="number"
              step="any"
              {...register('openingCash')}
              className="mt-2 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-355 dark:border-slate-800 rounded-lg text-lg font-bold"
            />
            {errors.openingCash && (
              <p className="mt-1 text-xs text-red-500">{errors.openingCash.message}</p>
            )}
          </div>

          {/* Closing Cash Input */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
              {t('closingCash')} (ਸ਼ਾਮ ਦਾ ਨਕਦ - ₹)
            </label>
            <input
              type="number"
              step="any"
              {...register('closingCash')}
              className="mt-2 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-355 dark:border-slate-800 rounded-lg text-lg font-bold"
            />
            {errors.closingCash && (
              <p className="mt-1 text-xs text-red-500">{errors.closingCash.message}</p>
            )}
          </div>
        </div>

        {/* Dynamic Calculations Widget */}
        <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-6 border border-slate-200 dark:border-slate-850 space-y-4">
          <h3 className="text-md font-bold border-b border-slate-200 dark:border-slate-800 pb-2">
            ਨਕਦ ਪ੍ਰਵਾਹ ਗਣਨਾ (Cash Flow Calculations)
          </h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>ਸ਼ੁਰੂਆਤੀ ਨਕਦ (Opening Cash):</span>
              <span className="font-bold">₹{Number(watchOpening).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>(+) ਅੱਜ ਦੀ ਨਕਦ ਵਿਕਰੀ (Cash Sales):</span>
              <span className="font-bold">+ ₹{metrics.salesCash.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>(+) ਗਾਹਕਾਂ ਤੋਂ ਜਮ੍ਹਾਂ ਨਕਦ (Khata Payments):</span>
              <span className="font-bold">+ ₹{metrics.paymentsReceivedCash.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-rose-600 dark:text-rose-455">
              <span>(-) ਅੱਜ ਦੇ ਨਕਦ ਖਰਚੇ (Cash Expenses):</span>
              <span className="font-bold">- ₹{metrics.expensesCash.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 text-md font-extrabold">
              <span>{t('expectedCash')}:</span>
              <span>₹{expectedCash.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Difference Output */}
        <div className={`p-4 rounded-xl border flex items-center justify-between font-bold text-lg ${
          difference === 0
            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-850 dark:text-emerald-400'
            : difference < 0
            ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-500 text-rose-850 dark:text-rose-400'
            : 'bg-amber-50 dark:bg-amber-950/20 border-amber-500 text-amber-850 dark:text-amber-400'
        }`}>
          <div className="flex items-center gap-2">
            {difference !== 0 && <AlertTriangle className="w-5 h-5" />}
            <span>{t('difference')}:</span>
          </div>
          <span>
            {difference > 0 ? '+' : ''} ₹{difference.toFixed(2)}
          </span>
        </div>

        {/* Notes Input */}
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
            {t('notes')} (ਕਲੋਜ਼ਿੰਗ ਨੋਟਸ)
          </label>
          <textarea
            {...register('notes')}
            className="mt-2 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-355 dark:border-slate-800 rounded-lg text-sm"
            rows={3}
            placeholder="e.g. ਕੋਈ ਫਰਕ ਹੋਣ ਦਾ ਕਾਰਨ ਜਾਂ ਹੋਰ ਟਿੱਪਣੀ..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-lg font-bold shadow-md transition-all disabled:opacity-50"
        >
          {loading ? 'ਦਰਜ ਹੋ ਰਿਹਾ ਹੈ...' : t('saveClosing')}
        </button>
      </form>
    </div>
  );
}
