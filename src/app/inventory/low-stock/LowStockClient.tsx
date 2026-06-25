'use client';

import React, { useState } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { adjustStockAction, dismissAlertAction } from '../../../lib/actions/inventory';
import { createPurchaseAction } from '../../../lib/actions/purchases';
import { TransactionType, PurchaseStatus } from '@prisma/client';
import { AlertTriangle, FileText, Check, Plus, RefreshCw, X } from 'lucide-react';

interface ProductWithSupplier {
  id: string;
  sku: string;
  barcode: string | null;
  nameEn: string;
  namePa: string;
  currentQuantity: string | number;
  reorderLevel: string | number;
  unit: string;
  purchasePrice: string | number;
  supplierId: string | null;
  supplier?: {
    id: string;
    name: string;
  } | null;
}

interface LowStockClientProps {
  lowStockProducts: ProductWithSupplier[];
  suppliers: { id: string; name: string }[];
}

export default function LowStockClient({ lowStockProducts, suppliers }: LowStockClientProps) {
  const { t, language } = useTranslation();
  const [products, setProducts] = useState<ProductWithSupplier[]>(lowStockProducts);
  const [adjustingProduct, setAdjustingProduct] = useState<ProductWithSupplier | null>(null);
  const [adjustQty, setAdjustQty] = useState<string>('');
  const [adjustPrice, setAdjustPrice] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modal Supplier assignment state for PO creation if product doesn't have a supplier
  const [assigningSupplierProduct, setAssigningSupplierProduct] = useState<ProductWithSupplier | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleDismiss = async (productId: string) => {
    try {
      setLoading(true);
      await dismissAlertAction(productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      showMsg(
        language === 'en'
          ? 'Alert dismissed successfully'
          : 'ਅਲਰਟ ਸਫਲਤਾਪੂਰਵਕ ਖਾਰਜ ਕਰ ਦਿੱਤਾ ਗਿਆ',
        'success'
      );
    } catch (err: any) {
      showMsg(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdjust = (prod: ProductWithSupplier) => {
    setAdjustingProduct(prod);
    setAdjustQty('');
    setAdjustPrice(Number(prod.purchasePrice).toString());
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    const qty = parseFloat(adjustQty);
    const price = parseFloat(adjustPrice);

    if (isNaN(qty) || qty <= 0) {
      showMsg(language === 'en' ? 'Enter a valid quantity' : 'ਸਹੀ ਮਾਤਰਾ ਦਰਜ ਕਰੋ', 'error');
      return;
    }

    if (isNaN(price) || price < 0) {
      showMsg(language === 'en' ? 'Enter a valid price' : 'ਸਹੀ ਰੇਟ ਦਰਜ ਕਰੋ', 'error');
      return;
    }

    try {
      setLoading(true);
      await adjustStockAction({
        productId: adjustingProduct.id,
        quantity: qty,
        type: TransactionType.ADJUSTMENT,
        price,
        note: 'Manual stock adjustment from low stock screen',
      });

      // Remove from list or update local quantity
      const newQty = Number(adjustingProduct.currentQuantity) + qty;
      if (newQty > Number(adjustingProduct.reorderLevel)) {
        setProducts((prev) => prev.filter((p) => p.id !== adjustingProduct.id));
      } else {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === adjustingProduct.id ? { ...p, currentQuantity: newQty } : p
          )
        );
      }

      setAdjustingProduct(null);
      showMsg(
        language === 'en' ? 'Stock adjusted successfully' : 'ਸਟਾਕ ਸਫਲਤਾਪੂਰਵਕ ਅਪਡੇਟ ਹੋ ਗਿਆ',
        'success'
      );
    } catch (err: any) {
      showMsg(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDraftPO = async (prod: ProductWithSupplier, supplierId: string) => {
    if (!supplierId) {
      setAssigningSupplierProduct(prod);
      setSelectedSupplierId('');
      return;
    }

    try {
      setLoading(true);
      const reorderQty = Math.max(10, Number(prod.reorderLevel) * 2 - Number(prod.currentQuantity));

      await createPurchaseAction({
        supplierId,
        items: [
          {
            productId: prod.id,
            quantity: reorderQty,
            purchasePrice: Number(prod.purchasePrice),
          },
        ],
        invoiceNumber: `DRAFT-PO-${Date.now().toString().slice(-6)}`,
        note: `Auto-generated draft purchase order for low stock item: ${prod.nameEn}`,
        paidAmount: 0,
        status: PurchaseStatus.DRAFT,
      });

      showMsg(
        language === 'en'
          ? 'Draft Purchase Order created successfully'
          : 'ਖਰੀਦ ਆਰਡਰ ਦਾ ਡਰਾਫਟ ਸਫਲਤਾਪੂਰਵਕ ਤਿਆਰ ਹੋ ਗਿਆ ਹੈ। ਖਰੀਦ (Purchases) ਸਕ੍ਰੀਨ ਤੇ ਚੈੱਕ ਕਰੋ।',
        'success'
      );
    } catch (err: any) {
      showMsg(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSupplierAndCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningSupplierProduct || !selectedSupplierId) return;

    const prod = assigningSupplierProduct;
    setAssigningSupplierProduct(null);
    await handleCreateDraftPO(prod, selectedSupplierId);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center justify-between text-sm font-semibold transition-all ${
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

      {products.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
            <Check className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
            {language === 'en' ? 'All stock levels are normal!' : 'ਸਾਰੀਆਂ ਆਈਟਮਾਂ ਦਾ ਸਟਾਕ ਠੀਕ ਹੈ!'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {language === 'en'
              ? 'No products are currently below their reorder safety levels.'
              : 'ਇਸ ਵੇਲੇ ਕੋਈ ਵੀ ਉਤਪਾਦ ਘੱਟੋ-ਘੱਟ ਸਟਾਕ ਲਿਮਿਟ ਤੋਂ ਹੇਠਾਂ ਨਹੀਂ ਹੈ।'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase text-slate-500 tracking-wider">
                <th className="py-3 px-4">{language === 'en' ? 'Product' : 'ਉਤਪਾਦ'}</th>
                <th className="py-3 px-4">{language === 'en' ? 'SKU' : 'ਆਈਟਮ ਕੋਡ (SKU)'}</th>
                <th className="py-3 px-4">{language === 'en' ? 'Current Stock' : 'ਮੌਜੂਦਾ ਸਟਾਕ'}</th>
                <th className="py-3 px-4">{language === 'en' ? 'Reorder Level' : 'ਘੱਟੋ-ਘੱਟ ਲਿਮਿਟ'}</th>
                <th className="py-3 px-4">{language === 'en' ? 'Supplier' : 'ਸਪਲਾਇਰ'}</th>
                <th className="py-3 px-4 text-right">{language === 'en' ? 'Actions' : 'ਕਾਰਵਾਈ'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {products.map((prod) => {
                const isUrgent = Number(prod.currentQuantity) <= 0;
                return (
                  <tr key={prod.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {language === 'en' ? prod.nameEn : prod.namePa}
                      </div>
                      {prod.barcode && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {prod.barcode}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs">{prod.sku}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                          isUrgent
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-450'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-450'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {Number(prod.currentQuantity)} {prod.unit}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-650 dark:text-slate-405">
                      {Number(prod.reorderLevel)} {prod.unit}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-350">
                      {prod.supplier ? (
                        prod.supplier.name
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-600 italic">
                          {language === 'en' ? 'None Assigned' : 'ਕੋਈ ਨਹੀਂ'}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleCreateDraftPO(prod, prod.supplierId || '')}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {language === 'en' ? 'PO Draft' : 'ਆਰਡਰ ਡਰਾਫਟ'}
                      </button>

                      <button
                        onClick={() => handleOpenAdjust(prod)}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 rounded-md text-xs font-semibold transition-all disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {language === 'en' ? 'Adjust' : 'ਸਟਾਕ ਪਾਓ'}
                      </button>

                      <button
                        onClick={() => handleDismiss(prod.id)}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md text-xs font-semibold transition-all disabled:opacity-50"
                      >
                        {language === 'en' ? 'Ignore' : 'ਛੱਡੋ'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ADJUST STOCK MODAL */}
      {adjustingProduct && (
        <div className="fixed inset-0 bg-black/55 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                  {language === 'en' ? 'Adjust Stock Level' : 'ਸਟਾਕ ਐਡਜਸਟ ਕਰੋ'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {language === 'en' ? adjustingProduct.nameEn : adjustingProduct.namePa}
                </p>
              </div>
              <button
                onClick={() => setAdjustingProduct(null)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustStock} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Quantity to Add' : 'ਜੋੜਨ ਵਾਲੀ ਮਾਤਰਾ'} ({adjustingProduct.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Purchase/Cost Price (₹)' : 'ਖਰੀਦ ਰੇਟ (₹)'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={adjustPrice}
                  onChange={(e) => setAdjustPrice(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-sm font-semibold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : language === 'en' ? (
                    'Confirm Adjustment'
                  ) : (
                    'ਐਡਜਸਟਮੈਂਟ ਕਨਫਰਮ ਕਰੋ'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN SUPPLIER MODAL */}
      {assigningSupplierProduct && (
        <div className="fixed inset-0 bg-black/55 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                  {language === 'en' ? 'Select Supplier for Purchase' : 'ਖਰੀਦ ਲਈ ਸਪਲਾਇਰ ਚੁਣੋ'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {language === 'en' ? assigningSupplierProduct.nameEn : assigningSupplierProduct.namePa}
                </p>
              </div>
              <button
                onClick={() => setAssigningSupplierProduct(null)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSupplierAndCreatePO} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Supplier / Wholesaler' : 'ਸਪਲਾਇਰ / ਹੋਲਸੇਲਰ'}
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">
                    {language === 'en' ? '-- Select Wholesaler --' : '-- ਹੋਲਸੇਲਰ ਚੁਣੋ --'}
                  </option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setAssigningSupplierProduct(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-sm font-semibold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedSupplierId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : language === 'en' ? (
                    'Generate PO Draft'
                  ) : (
                    'ਆਰਡਰ ਡਰਾਫਟ ਤਿਆਰ ਕਰੋ'
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
