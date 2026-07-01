'use client';

import React, { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { createSupplierAction, paySupplierAction, getSupplierLedgerAction } from '@/lib/actions/suppliers';
import { Plus, Search, IndianRupee, FileText, Check, Phone, Clipboard, ArrowDownRight, ArrowUpRight, X, RefreshCw } from 'lucide-react';
import { useToastStore } from '@/lib/store/toast';
import { EmptyState } from '@/components/ui/EmptyState';

interface Supplier {
  id: string;
  name: string;
  mobile: string | null;
  gst: string | null;
  currentBalance: string | number;
  createdAt: string;
}

interface LedgerEntry {
  id: string;
  type: string;
  amount: string | number;
  balanceAfter: string | number;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

interface SuppliersClientProps {
  initialSuppliers: Supplier[];
}

export default function SuppliersClient({ initialSuppliers }: SuppliersClientProps) {
  const { t, language } = useTranslation();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [search, setSearch] = useState<string>('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [showLedgerModal, setShowLedgerModal] = useState<boolean>(false);

  // Forms state
  const [newName, setNewName] = useState<string>('');
  const [newMobile, setNewMobile] = useState<string>('');
  const [newGst, setNewGst] = useState<string>('');
  const [newOpeningBalance, setNewOpeningBalance] = useState<string>('0');

  const { showToast } = useToastStore();

  const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payNote, setPayNote] = useState<string>('');

  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Calculations
  const filteredSuppliers = suppliers.filter((s) =>
    (s && s.name && s.name.toLowerCase().includes(search.toLowerCase())) ||
    (s && s.mobile && s.mobile.includes(search)) ||
    (s && s.gst && s.gst.toLowerCase().includes(search.toLowerCase()))
  );

  const totalDues = suppliers.reduce((sum, s) => sum + Number(s.currentBalance), 0);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setLoading(true);
      const res = await createSupplierAction({
        name: newName.trim(),
        mobile: newMobile.trim() || undefined,
        gst: newGst.trim() || undefined,
        currentBalance: parseFloat(newOpeningBalance) || 0,
      });

      if (res && 'success' in res && res.success === false) {
        showToast(res.error || 'Error saving supplier', 'error');
        return;
      }

      setSuppliers((prev) => [res, ...prev]);
      setShowAddModal(false);
      setNewName('');
      setNewMobile('');
      setNewGst('');
      setNewOpeningBalance('0');

      showToast(
        language === 'en' ? 'Supplier added successfully ✓' : 'ਸਪਲਾਇਰ ਸਫਲਤਾਪੂਰਵਕ ਜੋੜਿਆ ਗਿਆ ✓',
        'success'
      );
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPay = (sup: Supplier) => {
    setActiveSupplier(sup);
    setPayAmount('');
    setPayNote('');
    setShowPayModal(true);
  };

  const handlePaySupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSupplier) return;

    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast(language === 'en' ? 'Enter a valid amount' : 'ਸਹੀ ਰਕਮ ਦਰਜ ਕਰੋ', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await paySupplierAction(activeSupplier.id, amt, payNote.trim() || undefined);

      if (res && 'success' in res && res.success === false) {
        showToast(res.error || 'Error recording payment', 'error');
        return;
      }

      // Update local state
      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === activeSupplier.id
            ? { ...s, currentBalance: Number(s.currentBalance) - amt }
            : s
        )
      );

      setShowPayModal(false);
      showToast(
        language === 'en'
          ? 'Payment logged successfully ✓'
          : 'ਭੁਗਤਾਨ ਸਫਲਤਾਪੂਰਵਕ ਖਾਤੇ ਵਿੱਚ ਦਰਜ ਕਰ ਲਿਆ ਗਿਆ ਹੈ ✓',
        'success'
      );
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLedger = async (sup: Supplier) => {
    setActiveSupplier(sup);
    setLedgerEntries([]);
    setShowLedgerModal(true);
    try {
      setLoading(true);
      const res = await getSupplierLedgerAction(sup.id);
      setLedgerEntries(res);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* SUM CARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
            <IndianRupee className="w-36 h-36" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-rose-100">
            {language === 'en' ? 'Total Outstanding Owed' : 'ਸਪਲਾਇਰਾਂ ਦੇ ਕੁੱਲ ਦੇਣਦਾਰੀ ਪੈਸੇ'}
          </p>
          <h2 className="text-3xl font-extrabold mt-2">₹{totalDues.toFixed(2)}</h2>
          <p className="text-[11px] text-rose-200 mt-2">
            {language === 'en'
              ? `Outstanding balance across ${suppliers.length} active wholesalers.`
              : `ਕੁੱਲ ${suppliers.length} ਸਪਲਾਇਰਾਂ ਨੂੰ ਦੇਣ ਵਾਲੇ ਬਕਾਇਆ ਪੈਸੇ।`}
          </p>
        </div>
      </div>

      {/* FILTER BAR & BUTTON */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder={language === 'en' ? 'Search wholesalers by name, phone...' : 'ਸਪਲਾਇਰ ਦਾ ਨਾਮ, ਫੋਨ ਜਾਂ GST ਲੱਭੋ...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all"
        >
          <Plus className="w-5 h-5" />
          {language === 'en' ? 'Add Supplier' : 'ਨਵਾਂ ਸਪਲਾਇਰ ਜੋੜੋ'}
        </button>
      </div>

      {/* SUPPLIERS TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {filteredSuppliers.length === 0 ? (
          <div className="py-6 text-center">
            <EmptyState
              icon={Clipboard}
              title={language === 'en' ? 'No Suppliers Found' : 'ਕੋਈ ਸਪਲਾਇਰ ਨਹੀਂ ਲੱਭਿਆ।'}
              description={language === 'en' ? 'No Wholesalers Registered Yet. Click Add Supplier to create your first supplier.' : 'ਕੋਈ ਹੋਲਸੇਲਰ ਰਜਿਸਟਰਡ ਨਹੀਂ ਹੈ। ਪਹਿਲਾ ਸਪਲਾਇਰ ਬਣਾਉਣ ਲਈ ਜੋੜੋ ਬਟਨ ਦਬਾਓ।'}
              actionLabel={language === 'en' ? 'Add Supplier' : 'ਨਵਾਂ ਸਪਲਾਇਰ'}
              onAction={() => {
                setShowAddModal(true);
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase text-slate-500 tracking-wider">
                  <th className="py-3 px-6">{language === 'en' ? 'Wholesaler Name' : 'ਹੋਲਸੇਲਰ / ਸਪਲਾਇਰ'}</th>
                  <th className="py-3 px-6">{language === 'en' ? 'Mobile / Contact' : 'ਸੰਪਰਕ (ਮੋਬਾਈਲ)'}</th>
                  <th className="py-3 px-6">{language === 'en' ? 'GSTIN' : 'GST ਨੰਬਰ'}</th>
                  <th className="py-3 px-6">{language === 'en' ? 'Owed Balance' : 'ਦੇਣਦਾਰੀ ਬਕਾਇਆ (₹)'}</th>
                  <th className="py-3 px-6 text-right">{language === 'en' ? 'Actions' : 'ਕਾਰਵਾਈ'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredSuppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-4 px-6 font-semibold text-slate-950 dark:text-slate-50">
                      {sup.name}
                    </td>
                    <td className="py-4 px-6 text-slate-600 dark:text-slate-400">
                      {sup.mobile ? (
                        <span className="flex items-center gap-1.5 font-mono">
                          <Phone className="w-4 h-4 text-slate-400" />
                          {sup.mobile}
                        </span>
                      ) : (
                        <span className="italic text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      {sup.gst || <span className="italic text-slate-400">None</span>}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-950 dark:text-slate-550">
                      ₹{Number(sup.currentBalance).toFixed(2)}
                    </td>
                    <td className="py-4 px-6 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenPay(sup)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-md text-xs font-semibold transition-all"
                      >
                        <IndianRupee className="w-3.5 h-3.5" />
                        {language === 'en' ? 'Pay Off' : 'ਰਕਮ ਦਿਓ (Payment)'}
                      </button>

                      <button
                        onClick={() => handleOpenLedger(sup)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-250 rounded-md text-xs font-semibold transition-all"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {language === 'en' ? 'Ledger Statement' : 'ਖਾਤਾ ਬਹੀ'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD SUPPLIER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/55 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                  {language === 'en' ? 'Add New Supplier Wholesaler' : 'ਨਵਾਂ ਸਪਲਾਇਰ / ਹੋਲਸੇਲਰ ਜੋੜੋ'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Wholesaler / Company Name' : 'ਸਪਲਾਇਰ / ਫਰਮ ਦਾ ਨਾਮ'}
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Majha Agro Traders"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Mobile / Phone Number' : 'ਮੋਬਾਈਲ ਨੰਬਰ'}
                </label>
                <input
                  type="text"
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value)}
                  placeholder="e.g. 9812345678"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'GSTIN (Optional)' : 'GST ਨੰਬਰ (ਵਿਕਲਪਿਕ)'}
                </label>
                <input
                  type="text"
                  value={newGst}
                  onChange={(e) => setNewGst(e.target.value)}
                  placeholder="e.g. 03AAAAA1111A1Z1"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Opening Balance (₹ Owed)' : 'ਸ਼ੁਰੂਆਤੀ ਦੇਣਦਾਰੀ ਬਕਾਇਆ (₹)'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={newOpeningBalance}
                  onChange={(e) => setNewOpeningBalance(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-sm font-semibold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : language === 'en' ? (
                    'Add Supplier'
                  ) : (
                    'ਸਪਲਾਇਰ ਜੋੜੋ'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {showPayModal && activeSupplier && (
        <div className="fixed inset-0 bg-black/55 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                  {language === 'en' ? 'Record Wholesaler Payment' : 'ਸਪਲਾਇਰ ਭੁਗਤਾਨ ਦਰਜ ਕਰੋ'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {language === 'en' ? 'Paying off dues for:' : 'ਭੁਗਤਾਨ ਫਰਮ:'} {activeSupplier.name}
                </p>
              </div>
              <button
                onClick={() => setShowPayModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaySupplier} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Current Owed Balance' : 'ਮੌਜੂਦਾ ਬਕਾਇਆ ਦੇਣਦਾਰੀ'}
                </label>
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-900 dark:text-slate-100 font-bold font-mono">
                  ₹{Number(activeSupplier.currentBalance).toFixed(2)}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Amount Paid (₹)' : 'ਭੁਗਤਾਨ ਕੀਤੀ ਰਕਮ (₹)'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="e.g. 2000"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold font-mono"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Notes / Remarks' : 'ਵੇਰਵਾ / ਟਿੱਪਣੀ'}
                </label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="e.g. Paid in Cash / Cheque #1234"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-sm font-semibold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : language === 'en' ? (
                    'Confirm Payment'
                  ) : (
                    'ਭੁਗਤਾਨ ਕਨਫਰਮ ਕਰੋ'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LEDGER STATEMENTS MODAL */}
      {showLedgerModal && activeSupplier && (
        <div className="fixed inset-0 bg-black/55 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                  {language === 'en' ? 'Supplier Statement Ledger' : 'ਸਪਲਾਇਰ ਖਾਤਾ ਬਹੀ (ਸਟੇਟਮੈਂਟ)'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeSupplier.name} {activeSupplier.mobile && ` | ${activeSupplier.mobile}`}
                </p>
              </div>
              <button
                onClick={() => setShowLedgerModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto border border-slate-150 dark:border-slate-800 rounded-lg">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : ledgerEntries.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  {language === 'en' ? 'No transactions found.' : 'ਕੋਈ ਲੈਣ-ਦੇਣ ਨਹੀਂ ਮਿਲਿਆ।'}
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase text-slate-500 tracking-wider bg-slate-50 dark:bg-slate-850">
                      <th className="py-2.5 px-4">{language === 'en' ? 'Date' : 'ਤਾਰੀਖ'}</th>
                      <th className="py-2.5 px-4">{language === 'en' ? 'Type' : 'ਕਿਸਮ'}</th>
                      <th className="py-2.5 px-4">{language === 'en' ? 'Description / Notes' : 'ਵੇਰਵਾ'}</th>
                      <th className="py-2.5 px-4">{language === 'en' ? 'Amount (₹)' : 'ਰਕਮ (₹)'}</th>
                      <th className="py-2.5 px-4">{language === 'en' ? 'Balance After (₹)' : 'ਬਾਕਾਇਦਾ ₹'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {ledgerEntries.map((e) => {
                      const amt = Number(e.amount);
                      const isReduction = amt < 0; // Payment or returns reduce outstanding
                      return (
                        <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                            {new Date(e.createdAt).toLocaleString(language === 'en' ? 'en-US' : 'pa-IN')}
                          </td>
                          <td className="py-3 px-4 font-bold">
                            <span
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] uppercase ${
                                e.type === 'PURCHASE'
                                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400'
                                  : e.type === 'PAYMENT'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                              }`}
                            >
                              {isReduction ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                              {e.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-xs truncate" title={e.note || ''}>
                            {e.note || '-'}
                          </td>
                          <td className={`py-3 px-4 font-bold font-mono ${isReduction ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {isReduction ? '-' : '+'}₹{Math.abs(amt).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 font-bold font-mono">
                            ₹{Number(e.balanceAfter).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowLedgerModal(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-255 rounded-lg text-sm font-semibold transition-all"
              >
                {language === 'en' ? 'Close' : 'ਬੰਦ ਕਰੋ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
