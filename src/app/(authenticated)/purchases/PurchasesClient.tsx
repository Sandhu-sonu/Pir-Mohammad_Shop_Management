'use client';

import React, { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { createPurchaseAction, transitionPurchaseStatusAction, createPurchaseReturnAction, getPurchaseReturnsAction } from '@/lib/actions/purchases';
import { PurchaseStatus, PaymentMethod } from '@prisma/client';
import { Plus, Search, Trash2, Calendar, FileText, Check, ArrowRight, CornerUpLeft, RefreshCw, X } from 'lucide-react';

interface PurchaseItem {
  id: string;
  productId: string;
  quantity: string | number;
  purchasePrice: string | number;
  product: {
    nameEn: string;
    namePa: string;
    unit: string;
  };
}

interface PurchaseReturn {
  id: string;
  productId: string;
  quantity: string | number;
  purchasePrice: string | number;
  reason: string | null;
  createdAt: string;
}

interface Purchase {
  id: string;
  invoiceNumber: string | null;
  date: string;
  supplierId: string;
  total: string | number;
  paidAmount: string | number;
  dueAmount: string | number;
  status: PurchaseStatus;
  note: string | null;
  supplier: {
    name: string;
  };
  items: PurchaseItem[];
  purchaseReturns: PurchaseReturn[];
}

interface Product {
  id: string;
  sku: string | null;
  nameEn: string;
  namePa: string;
  purchasePrice: string | number;
  unit: string;
}

interface Wholesaler {
  id: string;
  name: string;
}

interface PurchasesClientProps {
  initialPurchases: Purchase[];
  suppliers: Wholesaler[];
  products: Product[];
}

export default function PurchasesClient({ initialPurchases, suppliers, products }: PurchasesClientProps) {
  const { t, language } = useTranslation();
  const [purchases, setPurchases] = useState<Purchase[]>(initialPurchases);
  const [search, setSearch] = useState<string>('');

  // POS billing states
  const [showPOS, setShowPOS] = useState<boolean>(false);
  const [supplierId, setSupplierId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [cartItems, setCartItems] = useState<{ productId: string; quantity: number; purchasePrice: number; name: string; unit: string }[]>([]);
  const [paidAmount, setPaidAmount] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [status, setStatus] = useState<PurchaseStatus>(PurchaseStatus.RECEIVED);

  // Return modal states
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [activePurchase, setActivePurchase] = useState<Purchase | null>(null);
  const [returnProductId, setReturnProductId] = useState<string>('');
  const [returnQty, setReturnQty] = useState<string>('');
  const [returnReason, setReturnReason] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Caching purchase state to local storage for crash/session recovery (Module 5)
  React.useEffect(() => {
    if (cartItems.length > 0 || supplierId || invoiceNumber || note) {
      localStorage.setItem(
        'draft_purchase_form',
        JSON.stringify({
          supplierId,
          invoiceNumber,
          note,
          cartItems,
          paidAmount,
          paymentMethod,
          status,
          showPOS,
          savedAt: Date.now(),
        })
      );
    } else {
      localStorage.removeItem('draft_purchase_form');
    }
  }, [supplierId, invoiceNumber, note, cartItems, paidAmount, paymentMethod, status, showPOS]);

  // Restoring purchase state on approval
  React.useEffect(() => {
    const approved = localStorage.getItem('draft_restore_approved');
    if (approved === 'true') {
      const draft = localStorage.getItem('draft_purchase_form');
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          const now = Date.now();
          // Verify 24-hour expiration threshold
          if (parsed.savedAt && now - parsed.savedAt <= 24 * 60 * 60 * 1000) {
            if (parsed.supplierId) setSupplierId(parsed.supplierId);
            if (parsed.invoiceNumber) setInvoiceNumber(parsed.invoiceNumber);
            if (parsed.note) setNote(parsed.note);
            if (parsed.cartItems) setCartItems(parsed.cartItems);
            if (parsed.paidAmount) setPaidAmount(parsed.paidAmount);
            if (parsed.paymentMethod) setPaymentMethod(parsed.paymentMethod);
            if (parsed.status) setStatus(parsed.status);
            if (parsed.showPOS) setShowPOS(parsed.showPOS);
          }
        } catch (e) {
          console.error('Failed to restore purchase draft', e);
        }
      }
    }
  }, []);

  // Calculations
  const filteredPurchases = purchases.filter((p) =>
    (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(search.toLowerCase())) ||
    (p.supplier?.name && p.supplier.name.toLowerCase().includes(search.toLowerCase()))
  );

  const cartTotal = cartItems.reduce((sum, item) => sum + item.quantity * item.purchasePrice, 0);
  const calculatedDue = Math.max(0, cartTotal - (parseFloat(paidAmount) || 0));

  const handleAddProductToCart = (prodId: string) => {
    if (!prodId) return;
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;

    // Check if already in cart
    const existing = cartItems.find((item) => item.productId === prodId);
    if (existing) {
      setCartItems((prev) =>
        prev.map((item) =>
          item.productId === prodId ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setCartItems((prev) => [
        ...prev,
        {
          productId: prod.id,
          quantity: 1,
          purchasePrice: Number(prod.purchasePrice),
          name: language === 'en' ? prod.nameEn : prod.namePa,
          unit: prod.unit,
        },
      ]);
    }
  };

  const handleRemoveFromCart = (prodId: string) => {
    setCartItems((prev) => prev.filter((item) => item.productId !== prodId));
  };

  const handleUpdateCartQty = (prodId: string, qty: number) => {
    if (qty <= 0) return;
    setCartItems((prev) =>
      prev.map((item) => (item.productId === prodId ? { ...item, quantity: qty } : item))
    );
  };

  const handleUpdateCartPrice = (prodId: string, price: number) => {
    if (price < 0) return;
    setCartItems((prev) =>
      prev.map((item) => (item.productId === prodId ? { ...item, purchasePrice: price } : item))
    );
  };

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      showMsg(language === 'en' ? 'Select a supplier' : 'ਸਪਲਾਇਰ ਚੁਣੋ', 'error');
      return;
    }
    if (cartItems.length === 0) {
      showMsg(language === 'en' ? 'Cart is empty' : 'ਖਰੀਦ ਸੂਚੀ ਖਾਲੀ ਹੈ', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await createPurchaseAction({
        supplierId,
        items: cartItems.map((c) => ({
          productId: c.productId,
          quantity: c.quantity,
          purchasePrice: c.purchasePrice,
        })),
        invoiceNumber: invoiceNumber.trim() || undefined,
        note: note.trim() || undefined,
        paidAmount: parseFloat(paidAmount) || 0,
        status,
      });

      // Reload purchases list
      setPurchases((prev) => [res, ...prev]);
      setShowPOS(false);
      setCartItems([]);
      setSupplierId('');
      setInvoiceNumber('');
      setNote('');
      setPaidAmount('0');
      setStatus(PurchaseStatus.RECEIVED);
      localStorage.removeItem('draft_purchase_form');

      showMsg(
        language === 'en' ? 'Purchase logged successfully' : 'ਖਰੀਦ ਬਿੱਲ ਸਫਲਤਾਪੂਰਵਕ ਦਰਜ ਕਰ ਲਿਆ ਗਿਆ ਹੈ',
        'success'
      );
    } catch (err: any) {
      showMsg(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTransitionStatus = async (purchaseId: string) => {
    try {
      setLoading(true);
      const res = await transitionPurchaseStatusAction(purchaseId, PurchaseStatus.RECEIVED);
      
      setPurchases((prev) =>
        prev.map((p) => (p.id === purchaseId ? { ...p, ...res } : p))
      );

      showMsg(
        language === 'en' ? 'Stock received and inventory updated' : 'ਮਾਲ ਪ੍ਰਾਪਤ ਹੋਇਆ ਅਤੇ ਸਟਾਕ ਅਪਡੇਟ ਕਰ ਦਿੱਤਾ ਗਿਆ',
        'success'
      );
    } catch (err: any) {
      showMsg(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReturn = (p: Purchase) => {
    setActivePurchase(p);
    setReturnProductId('');
    setReturnQty('');
    setReturnReason('');
    setShowReturnModal(true);
  };

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePurchase || !returnProductId) return;

    const qty = parseFloat(returnQty);
    if (isNaN(qty) || qty <= 0) {
      showMsg(language === 'en' ? 'Enter a valid return quantity' : 'ਸਹੀ ਵਾਪਸੀ ਮਾਤਰਾ ਦਰਜ ਕਰੋ', 'error');
      return;
    }

    try {
      setLoading(true);
      const returnRes = await createPurchaseReturnAction({
        purchaseId: activePurchase.id,
        productId: returnProductId,
        quantity: qty,
        reason: returnReason.trim() || undefined,
      });

      // Update purchase record inside local state with new returns list
      setPurchases((prev) =>
        prev.map((p) => {
          if (p.id === activePurchase.id) {
            return {
              ...p,
              currentBalance: Number(p.dueAmount) - (qty * Number(returnRes.purchasePrice)), // Reduce due
              purchaseReturns: [...p.purchaseReturns, returnRes],
            };
          }
          return p;
        })
      );

      setShowReturnModal(false);
      showMsg(
        language === 'en'
          ? 'Damaged goods return logged successfully'
          : 'ਖਰਾਬ ਸਮਾਨ ਦੀ ਵਾਪਸੀ ਸਫਲਤਾਪੂਰਵਕ ਦਰਜ ਕਰ ਲਈ ਗਈ ਹੈ।',
        'success'
      );
    } catch (err: any) {
      showMsg(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ERROR / SUCCESS FEEDBACK */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-sm font-semibold transition-all ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5" />
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* POS CREATION PAGE */}
      {showPOS ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50">
              {language === 'en' ? 'New Purchase Billing Invoice' : 'ਨਵਾਂ ਖਰੀਦ ਬਿੱਲ POS'}
            </h2>
            <button
              onClick={() => setShowPOS(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold"
            >
              {language === 'en' ? 'Back to Invoices' : 'ਬਿੱਲ ਸੂਚੀ ਦੇਖੋ'}
            </button>
          </div>

          <form onSubmit={handleCreatePurchase} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT / CENTER: PRODUCTS AND BILL LIST */}
            <div className="lg:col-span-2 space-y-6">
              {/* SELECT PRODUCT LOOKUP */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Quick Add Product' : 'ਉਤਪਾਦ ਲੱਭੋ / ਜੋੜੋ'}
                </label>
                <div className="relative">
                  <select
                    onChange={(e) => {
                      handleAddProductToCart(e.target.value);
                      e.target.value = ''; // Reset select after adding
                    }}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">
                      {language === 'en' ? '-- Select Product to Add --' : '-- ਸਟਾਕ ਸੂਚੀ ਵਿੱਚੋਂ ਸਮਾਨ ਚੁਣੋ --'}
                    </option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {language === 'en' ? p.nameEn : p.namePa} ({p.sku || 'No SKU'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* CART ITEMS TABLE */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {cartItems.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 italic">
                    {language === 'en' ? 'No products added to bill.' : 'ਸੂਚੀ ਖਾਲੀ ਹੈ। ਉੱਪਰੋਂ ਸਮਾਨ ਜੋੜੋ।'}
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase bg-slate-50 dark:bg-slate-850">
                        <th className="py-2.5 px-4">{language === 'en' ? 'Product' : 'ਉਤਪਾਦ'}</th>
                        <th className="py-2.5 px-4">{language === 'en' ? 'Purchase Price (₹)' : 'ਖਰੀਦ ਰੇਟ (₹)'}</th>
                        <th className="py-2.5 px-4">{language === 'en' ? 'Quantity' : 'ਮਾਤਰਾ'}</th>
                        <th className="py-2.5 px-4">{language === 'en' ? 'Total' : 'ਕੁੱਲ'}</th>
                        <th className="py-2.5 px-4 text-center">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                      {cartItems.map((item) => (
                        <tr key={item.productId}>
                          <td className="py-3 px-4 font-semibold">{item.name}</td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              step="any"
                              value={item.purchasePrice}
                              onChange={(e) => handleUpdateCartPrice(item.productId, parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-slate-250 dark:border-slate-700 rounded bg-transparent font-bold font-mono text-center"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step="any"
                                value={item.quantity}
                                onChange={(e) => handleUpdateCartQty(item.productId, parseFloat(e.target.value) || 1)}
                                className="w-16 px-2 py-1 border border-slate-250 dark:border-slate-700 rounded bg-transparent font-bold font-mono text-center"
                              />
                              <span className="text-xs text-slate-400 font-bold">{item.unit}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-bold font-mono">
                            ₹{(item.quantity * item.purchasePrice).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(item.productId)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: SUPPLIER, PAYMENT INFO & SUMMARY */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-850 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Supplier Wholesaler' : 'ਸਪਲਾਇਰ ਚੁਣੋ'}
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none"
                  required
                >
                  <option value="">
                    {language === 'en' ? '-- Select Supplier --' : '-- ਸਪਲਾਇਰ ਚੁਣੋ --'}
                  </option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Invoice/Bill Number' : 'ਬਿੱਲ ਨੰਬਰ'}
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-1025"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Order Status' : 'ਆਰਡਰ ਸਥਿਤੀ'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus(PurchaseStatus.RECEIVED)}
                    className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                      status === PurchaseStatus.RECEIVED
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'en' ? 'Received (In Stock)' : 'ਰਿਸੀਵਡ (ਮਾਲ ਆ ਗਿਆ)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus(PurchaseStatus.DRAFT)}
                    className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                      status === PurchaseStatus.DRAFT
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'en' ? 'Draft (Placed)' : 'ਡਰਾਫਟ (ਆਰਡਰ ਕੀਤਾ)'}
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 my-4 pt-4 space-y-2">
                <div className="flex justify-between text-sm font-semibold">
                  <span>{language === 'en' ? 'Subtotal' : 'ਕੁੱਲ ਰੇਟ'}</span>
                  <span className="font-mono">₹{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-slate-900 dark:text-slate-50">
                  <span>{language === 'en' ? 'Total Bill' : 'ਕੁੱਲ ਬਿੱਲ'}</span>
                  <span className="font-mono">₹{cartTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Paid Amount (₹)' : 'ਭੁਗਤਾਨ ਕੀਤੀ ਰਕਮ (₹)'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm font-bold font-mono"
                  required
                />
              </div>

              <div className="flex justify-between text-sm font-bold text-rose-700 dark:text-rose-450 bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-lg">
                <span>{language === 'en' ? 'Due Amount (Owed)' : 'ਬਾਕੀ ਉਧਾਰ ਦੇਣਾ'}</span>
                <span className="font-mono">₹{calculatedDue.toFixed(2)}</span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Payment Method' : 'ਭੁਗਤਾਨ ਵਿਧੀ'}
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm"
                >
                  <option value={PaymentMethod.CASH}>{t('cash')}</option>
                  <option value={PaymentMethod.UPI}>{t('upi')}</option>
                  <option value={PaymentMethod.CREDIT}>{t('credit')}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Remarks / Notes' : 'ਟਿੱਪਣੀ'}
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Wheat flour bags for retail"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                {language === 'en' ? 'Save Purchase Invoice' : 'ਖਰੀਦ ਇਨਵੌਇਸ ਸੇਵ ਕਰੋ'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SEARCH BAR & NEW PURCHASE POS TOGGLE */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder={language === 'en' ? 'Search invoice, supplier name...' : 'ਬਿੱਲ ਨੰਬਰ ਜਾਂ ਸਪਲਾਇਰ ਦਾ ਨਾਮ ਲੱਭੋ...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <button
              onClick={() => setShowPOS(true)}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all"
            >
              <Plus className="w-5 h-5" />
              {language === 'en' ? 'New Purchase POS' : 'ਨਵਾਂ ਖਰੀਦ ਬਿੱਲ (POS)'}
            </button>
          </div>

          {/* LIST INVOICES */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {filteredPurchases.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                {language === 'en' ? 'No purchase invoices logged yet.' : 'ਕੋਈ ਖਰੀਦ ਬਿੱਲ ਦਰਜ ਨਹੀਂ ਹੈ।'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase text-slate-500 tracking-wider">
                      <th className="py-3 px-6">{language === 'en' ? 'Invoice No' : 'ਬਿੱਲ ਨੰਬਰ'}</th>
                      <th className="py-3 px-6">{language === 'en' ? 'Date' : 'ਤਾਰੀਖ'}</th>
                      <th className="py-3 px-6">{language === 'en' ? 'Supplier Name' : 'ਸਪਲਾਇਰ ਫਰਮ'}</th>
                      <th className="py-3 px-6">{language === 'en' ? 'Total (₹)' : 'ਕੁੱਲ ਬਿੱਲ'}</th>
                      <th className="py-3 px-6">{language === 'en' ? 'Status' : 'ਸਥਿਤੀ'}</th>
                      <th className="py-3 px-6 text-right">{language === 'en' ? 'Actions' : 'ਕਾਰਵਾਈ'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {filteredPurchases.map((p) => {
                      const returnSum = (p.purchaseReturns || []).reduce((sum, r) => sum + Number(r.quantity) * Number(r.purchasePrice), 0);
                      const displayDue = Math.max(0, Number(p.dueAmount) - returnSum);

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-4 px-6 font-semibold text-blue-650 dark:text-blue-400">
                            {p.invoiceNumber || `PO-${p.id.slice(-6).toUpperCase()}`}
                          </td>
                          <td className="py-4 px-6 text-slate-600 dark:text-slate-400 font-mono text-xs">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              {new Date(p.date).toLocaleDateString(language === 'en' ? 'en-US' : 'pa-IN')}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-semibold text-slate-900 dark:text-slate-50">
                            {p.supplier?.name || 'Unknown Supplier'}
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-bold">₹{Number(p.total).toFixed(2)}</div>
                            <div className="text-xs text-rose-650 dark:text-rose-450 mt-0.5">
                              {language === 'en' ? 'Due:' : 'ਉਧਾਰ:'} ₹{displayDue.toFixed(2)}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`inline-flex px-2.5 py-1 rounded text-xs font-bold ${
                                p.status === PurchaseStatus.DRAFT
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                                  : p.status === PurchaseStatus.RECEIVED || p.status === PurchaseStatus.COMPLETED
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right space-x-2 whitespace-nowrap">
                            {p.status === PurchaseStatus.DRAFT && (
                              <button
                                onClick={() => handleTransitionStatus(p.id)}
                                disabled={loading}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition-all shadow-sm"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                                {language === 'en' ? 'Receive Goods' : 'ਮਾਲ ਪ੍ਰਾਪਤ ਕਰੋ'}
                              </button>
                            )}

                            {(p.status === PurchaseStatus.RECEIVED || p.status === PurchaseStatus.COMPLETED) && (
                              <button
                                onClick={() => handleOpenReturn(p)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-md text-xs font-semibold transition-all"
                              >
                                <CornerUpLeft className="w-3.5 h-3.5" />
                                {language === 'en' ? 'Return damaged' : 'ਮਾਲ ਵਾਪਸੀ'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RETURN damaged GOODS MODAL */}
      {showReturnModal && activePurchase && (
        <div className="fixed inset-0 bg-black/55 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                  {language === 'en' ? 'Record Purchase Return' : 'ਖਰੀਦਿਆ ਮਾਲ ਵਾਪਸ ਕਰੋ (Return)'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {language === 'en' ? 'Invoice Number:' : 'ਇਨਵੌਇਸ:'} {activePurchase.invoiceNumber || `PO-${activePurchase.id.slice(-6).toUpperCase()}`}
                </p>
              </div>
              <button
                onClick={() => setShowReturnModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReturn} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Select Product to Return' : 'ਵਾਪਸ ਕਰਨ ਵਾਲਾ ਸਮਾਨ'}
                </label>
                <select
                  value={returnProductId}
                  onChange={(e) => setReturnProductId(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none"
                  required
                >
                  <option value="">
                    {language === 'en' ? '-- Select Product --' : '-- ਸਮਾਨ ਚੁਣੋ --'}
                  </option>
                  {activePurchase.items.map((item) => {
                    const returnedSum = (activePurchase.purchaseReturns || [])
                      .filter((r) => r.productId === item.productId)
                      .reduce((sum, r) => sum + Number(r.quantity), 0);
                    const maxQty = Number(item.quantity) - returnedSum;

                    return (
                      <option key={item.productId} value={item.productId} disabled={maxQty <= 0}>
                        {language === 'en' ? item.product.nameEn : item.product.namePa} (Bought: {Number(item.quantity)}, Remaining: {maxQty})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Return Quantity' : 'ਵਾਪਸੀ ਮਾਤਰਾ'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={returnQty}
                  onChange={(e) => setReturnQty(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm font-bold font-mono"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Reason for Return' : 'ਵਾਪਸੀ ਦਾ ਕਾਰਨ'}
                </label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Damaged / Expired stock"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-sm font-semibold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading || !returnProductId}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : language === 'en' ? (
                    'Record Return'
                  ) : (
                    'ਵਾਪਸੀ ਦਰਜ ਕਰੋ'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
