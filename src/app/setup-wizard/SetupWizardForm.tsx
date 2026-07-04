'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addProductAction } from '@/lib/actions/inventory';

interface SetupWizardFormProps {
  shopId: string;
  initialName: string;
  initialPhone: string;
}

export default function SetupWizardForm({ shopId, initialName, initialPhone }: SetupWizardFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Shop details
  const [address, setAddress] = useState('');
  const [gst, setGst] = useState('');

  // Step 2: First Product details
  const [prodNameEn, setProdNameEn] = useState('');
  const [prodNamePa, setProdNamePa] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('0');
  const [sellingPrice, setSellingPrice] = useState('0');
  const [qty, setQty] = useState('10');
  const [unit, setUnit] = useState('pcs');

  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Update Shop via API route
      const shopRes = await fetch(`/api/shop/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, address, gst })
      });

      const shopData = await shopRes.json();
      if (!shopData.success) {
        setError(shopData.error || 'Failed to update shop details');
        setLoading(false);
        return;
      }

      // 2. Add first product using standard server action
      if (!prodNameEn) {
        setError('ਕਿਰਪਾ ਕਰਕੇ ਪਹਿਲੇ ਉਤਪਾਦ ਦਾ ਨਾਮ ਭਰੋ (Please enter first product name)');
        setLoading(false);
        return;
      }

      const prodRes = await addProductAction({
        nameEn: prodNameEn,
        namePa: prodNamePa,
        sku: 'SKU-FIRST-' + Math.floor(1000 + Math.random() * 9000),
        barcode: '',
        purchasePrice: parseFloat(purchasePrice) || 0,
        sellingPrice: parseFloat(sellingPrice) || 0,
        currentQuantity: parseFloat(qty) || 0,
        minStock: 2,
        unit
      });

      if (!prodRes.success) {
        setError('error' in prodRes ? (prodRes.error as string) : 'Failed to create first product');
        setLoading(false);
        return;
      }

      // Success! Redirect to main dashboard
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError('ਸੈੱਟਅੱਪ ਦੌਰਾਨ ਤਰੁੱਟੀ ਆਈ (Setup failed. Verify inputs.)');
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="bg-red-950 text-red-400 border border-red-900 p-4 rounded-xl mb-6 font-bold text-sm text-center">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <span className="text-xs uppercase tracking-wider text-primary font-bold" style={{ color: '#FF6B6B' }}>ਕਦਮ 1/2 (Step 1/2)</span>
            <h2 className="text-xl font-bold text-white mt-1">Shop Details / ਦੁਕਾਨ ਦਾ ਵੇਰਵਾ</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Shop Name / ਦੁਕਾਨ ਦਾ ਨਾਮ</label>
              <input
                type="text"
                disabled
                value={initialName}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-gray-500 font-medium cursor-not-allowed text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Shop Address / ਪਤਾ</label>
              <textarea
                placeholder="Enter shop address..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">GSTIN Number / ਜੀ.ਐੱਸ.ਟੀ ਨੰਬਰ (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 03AAAAA1111A1Z1"
                value={gst}
                onChange={(e) => setGst(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
              />
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            className="w-full bg-primary hover:bg-opacity-95 text-white font-bold py-3 rounded-xl transition duration-200 mt-4 text-sm"
            style={{ backgroundColor: '#FF6B6B' }}
          >
            Next: Add First Product / ਅੱਗੇ ਚੱਲੋ
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div>
            <span className="text-xs uppercase tracking-wider text-primary font-bold" style={{ color: '#FF6B6B' }}>ਕਦਮ 2/2 (Step 2/2)</span>
            <h2 className="text-xl font-bold text-white mt-1">Add First Product / ਪਹਿਲਾ ਉਤਪਾਦ ਜੋੜੋ</h2>
            <p className="text-xs text-gray-400 mt-1">
              Add your first inventory item to complete setup (e.g. Sugar, Milk, Tea)
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Product Name (English)</label>
                <input
                  type="text"
                  placeholder="e.g. Sugar 1kg"
                  value={prodNameEn}
                  onChange={(e) => setProdNameEn(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">ਉਤਪਾਦ ਦਾ ਨਾਮ (Punjabi)</label>
                <input
                  type="text"
                  placeholder="e.g. ਖੰਡ 1 ਕਿੱਲੋ"
                  value={prodNamePa}
                  onChange={(e) => setProdNamePa(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Purchase Price</label>
                <input
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Selling Price</label>
                <input
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Initial Qty</label>
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-primary text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Unit / ਇਕਾਈ</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-primary text-sm"
              >
                <option value="pcs">Pieces (ਨਗ)</option>
                <option value="kg">Kilograms (ਕਿੱਲੋ)</option>
                <option value="liters">Liters (ਲੀਟਰ)</option>
                <option value="boxes">Boxes (ਡੱਬੇ)</option>
              </select>
            </div>
          </div>

          <div className="flex space-x-4 mt-6">
            <button
              onClick={() => setStep(1)}
              disabled={loading}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition duration-200 text-sm"
            >
              Back / ਪਿੱਛੇ ਚੱਲੋ
            </button>
            <button
              onClick={handleCompleteSetup}
              disabled={loading}
              className="flex-1 bg-primary text-white font-bold py-3 rounded-xl transition duration-200 hover:bg-opacity-95 text-sm"
              style={{ backgroundColor: '#FF6B6B' }}
            >
              {loading ? 'Setting up...' : 'Complete Setup / ਸੈੱਟਅੱਪ ਮੁਕੰਮਲ ਕਰੋ'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
