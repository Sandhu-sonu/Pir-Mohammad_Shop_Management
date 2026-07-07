'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updatePlanAction } from '@/lib/actions/admin';
import { BillingPeriod } from '@prisma/client';

interface FeatureConfig {
  id: string;
  featureId: string;
  featureName: string;
  featureCode: string;
  enabled: boolean;
  limitType: string;
  limitValue: number;
}

interface EditPlanFormProps {
  plan: {
    id: string;
    name: string;
    price: number;
    billingPeriod: BillingPeriod;
  };
  features: FeatureConfig[];
}

export default function EditPlanForm({ plan, features: initialFeatures }: EditPlanFormProps) {
  const router = useRouter();
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(plan.price);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(plan.billingPeriod);
  const [features, setFeatures] = useState<FeatureConfig[]>(initialFeatures);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFeatureToggle = (index: number) => {
    const updated = [...features];
    updated[index].enabled = !updated[index].enabled;
    setFeatures(updated);
  };

  const handleLimitChange = (index: number, val: number) => {
    const updated = [...features];
    updated[index].limitValue = val;
    setFeatures(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const res = await updatePlanAction(plan.id, {
      name,
      price: Number(price),
      billingPeriod,
      features: features.map(f => ({
        featureId: f.featureId,
        enabled: f.enabled,
        limitValue: f.enabled ? Number(f.limitValue) : 0
      }))
    });

    setLoading(false);
    if (res.success) {
      setSuccess('Plan limits and configuration updated successfully! / ਪਲਾਨ ਸੰਰਚਨਾ ਸਫਲਤਾਪੂਰਵਕ ਸੁਰੱਖਿਅਤ ਕੀਤੀ ਗਈ।');
      router.refresh();
    } else {
      setError(res.error || 'Failed to update plan limits.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="bg-red-950 border border-red-900 text-red-400 p-4 rounded-xl text-sm font-bold">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-950 border border-green-900 text-green-400 p-4 rounded-xl text-sm font-bold">
          {success}
        </div>
      )}

      {/* Plan Details Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white uppercase tracking-wider">Plan Properties / ਪਲਾਨ ਵੇਰਵਾ</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Plan Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF6B6B]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Price (INR)</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF6B6B]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Billing Period</label>
            <select
              value={billingPeriod}
              onChange={(e) => setBillingPeriod(e.target.value as BillingPeriod)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF6B6B]"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
              <option value="LIFETIME">Lifetime</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quotas & Features Checklist */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white uppercase tracking-wider">Feature Quotas & Permissions / ਕੋਟਾ ਅਤੇ ਸਹੂਲਤਾਂ</h3>

        <div className="divide-y divide-gray-800">
          {features.map((f, idx) => (
            <div key={f.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 first:pt-0 last:pb-0">
              <div className="space-y-1">
                <span className="text-sm font-bold text-white block">{f.featureName}</span>
                <span className="text-xs text-gray-500 block">Code: {f.featureCode} | Limit Type: {f.limitType}</span>
              </div>

              <div className="flex items-center gap-6">
                {/* Enabled Toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={f.enabled}
                    onChange={() => handleFeatureToggle(idx)}
                    className="w-4 h-4 rounded bg-gray-950 border-gray-800 text-[#FF6B6B] focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-gray-300">Enabled</span>
                </label>

                {/* Limit Value Box */}
                {f.limitType !== 'ACCESS' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Max Limit:</span>
                    <input
                      type="number"
                      value={f.limitValue}
                      disabled={!f.enabled}
                      onChange={(e) => handleLimitChange(idx, Number(e.target.value))}
                      className="w-24 bg-gray-950 border border-gray-800 disabled:opacity-40 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF6B6B]"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-[#FF6B6B] hover:bg-[#ff5252] disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition duration-200"
        >
          {loading ? 'Saving Changes...' : 'Save Plan Configuration / ਸੁਰੱਖਿਅਤ ਕਰੋ'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/plans')}
          className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition duration-200 border border-gray-700"
        >
          Cancel / ਰੱਦ ਕਰੋ
        </button>
      </div>
    </form>
  );
}
