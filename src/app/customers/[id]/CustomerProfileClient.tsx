'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '../../../hooks/useTranslation';
import { receivePaymentAction } from '../../../lib/actions/customers';
import {
  ArrowLeft,
  IndianRupee,
  Calendar,
  PlusCircle,
  Printer,
  History,
  X,
} from 'lucide-react';
import Link from 'next/link';

interface ProfileProps {
  profile: {
    customer: {
      id: string;
      name: string;
      mobile: string | null;
      address: string | null;
      notes: string | null;
      currentBalance: number;
    };
    totalPurchases: number;
    pendingAmount: number;
    lastPurchase: {
      date: string;
      total: number;
      invoiceNumber: string;
    } | null;
    recentPayments: {
      id: string;
      amount: number;
      note: string | null;
      date: string;
    }[];
  };
  ledger: any[];
  customerId: string;
}

export default function CustomerProfileClient({ profile, ledger, customerId }: ProfileProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReceivePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }

    setLoading(true);
    try {
      const res = await receivePaymentAction(customerId, amountNum, payNote);
      if (res.success) {
        setIsPayOpen(false);
        setPayAmount('');
        setPayNote('');
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || 'Payment submission failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Back button & Action buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div className="flex items-center gap-3">
          <Link
            href="/customers"
            className="p-2.5 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-850 bg-white dark:bg-slate-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {profile.customer.name}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {profile.customer.mobile || 'No Mobile'} | {profile.customer.address || 'No Address'}
            </p>
          </div>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-initial px-5 py-3 border border-slate-205 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4 text-slate-550" />
            {t('printLedger')}
          </button>
          
          <button
            onClick={() => setIsPayOpen(true)}
            className="flex-1 sm:flex-initial px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            ਜਮ੍ਹਾਂ ਕਰੋ (Receive Payment)
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 no-print">
        {/* Card 1: Outstanding Balance */}
        <div className="p-6 rounded-2xl border-2 border-amber-200 bg-white dark:bg-slate-900 dark:border-amber-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('currentBalance')}</p>
            <p className="text-3xl font-extrabold tracking-tight text-amber-705 dark:text-amber-400 mt-1.5">
              ₹{profile.pendingAmount.toFixed(2)}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-600">
            <IndianRupee className="w-7 h-7" />
          </div>
        </div>

        {/* Card 2: Total Purchases */}
        <div className="p-6 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Purchases</p>
            <p className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mt-1.5">
              ₹{profile.totalPurchases.toFixed(2)}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-600">
            <IndianRupee className="w-7 h-7" />
          </div>
        </div>

        {/* Card 3: Last Purchase */}
        <div className="p-6 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Last Purchase</p>
            {profile.lastPurchase ? (
              <div className="mt-1.5">
                <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                  ₹{profile.lastPurchase.total.toFixed(2)}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {profile.lastPurchase.invoiceNumber} | {new Date(profile.lastPurchase.date).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <p className="text-sm font-bold text-slate-400 mt-3">No purchases recorded</p>
            )}
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-slate-500">
            <Calendar className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* PRINTABLE AREA FOR THE LEDGER STATEMENT */}
      <div className="print-area bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden p-6">
        
        {/* Printable Header - hidden in normal screen */}
        <div className="hidden print:block mb-8 border-b-2 border-slate-300 pb-4 text-center">
          <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-wide">
            ਬਹੀ ਖਾਤਾ ਸਟੇਟਮੈਂਟ (Khata Ledger Statement)
          </h2>
          <div className="mt-4 grid grid-cols-2 text-left text-sm gap-2">
            <div><strong>Shop:</strong> Sher-E-Punjab Retail</div>
            <div><strong>Customer:</strong> {profile.customer.name}</div>
            <div><strong>Mobile:</strong> {profile.customer.mobile || '-'}</div>
            <div><strong>Outstanding Balance:</strong> ₹{profile.pendingAmount.toFixed(2)}</div>
          </div>
        </div>

        <h3 className="text-lg font-bold flex items-center mb-4 no-print">
          <History className="w-5 h-5 text-blue-500 mr-2" />
          {t('khataLedger')}
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
            <thead>
              <tr className="border-b border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">{t('date')}</th>
                <th className="py-3.5 px-4">{t('type')}</th>
                <th className="py-3.5 px-4">{t('notes')}</th>
                <th className="py-3.5 px-4 text-right">{t('amount')}</th>
                <th className="py-3.5 px-4 text-right">{t('balance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold">
                    No transactions recorded.
                  </td>
                </tr>
              ) : (
                ledger.map((item) => {
                  const amount = Number(item.amount);
                  const isAddition = amount > 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4">
                        {new Date(item.createdAt).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                          item.type === 'SALE' 
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/20' 
                            : item.type === 'PAYMENT' 
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800'
                        }`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium max-w-xs truncate" title={item.note || ''}>
                        {item.note || '-'}
                      </td>
                      <td className={`py-3.5 px-4 text-right font-bold ${
                        isAddition ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        {isAddition ? '+' : ''}₹{amount.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 dark:text-slate-100">
                        ₹{Number(item.balanceAfter).toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* COLLECT PAYMENT MODAL */}
      {isPayOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-500" />
                ਜਮ੍ਹਾਂ ਕਰੋ (Receive Payment)
              </h2>
              <button onClick={() => setIsPayOpen(false)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReceivePaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  ਭੁਗਤਾਨ ਰਕਮ (Payment Amount - ₹)
                </label>
                <input
                  type="number"
                  step="any"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-lg font-bold text-emerald-600"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  ਵੇਰਵਾ / ਰਿਮਾਰਕਸ (Description / Note)
                </label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm"
                  placeholder="e.g. Cash collected"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPayOpen(false)}
                  className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow disabled:opacity-50"
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
