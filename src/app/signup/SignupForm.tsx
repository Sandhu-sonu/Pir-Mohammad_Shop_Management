'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createShopOnboardingAction } from '@/lib/actions/onboarding';
import { BusinessType } from '@prisma/client';

export default function SignupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>(BusinessType.GENERAL_STORE);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await createShopOnboardingAction({
        shopName,
        ownerName,
        mobile,
        email,
        passwordInput: password,
        businessType
      });

      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/');
        }, 3000);
      } else {
        setError(res.error || 'Registration failed');
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      setError('ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਦੌਰਾਨ ਤਰੁੱਟੀ ਆਈ (Registration failed. Verify inputs.)');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="text-green-500 text-5xl">🎉</div>
        <h2 className="text-xl font-bold text-white">ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਸਫਲ! (Registration Successful)</h2>
        <p className="text-gray-400 text-sm">
          ਤੁਹਾਡੀ 14-ਦਿਨਾਂ ਦੀ ਟ੍ਰਾਇਲ ਸਬਸਕ੍ਰਿਪਸ਼ਨ ਸਰਗਰਮ ਹੋ ਗਈ ਹੈ। (Your 14-day Trial subscription is active.)
        </p>
        <p className="text-primary text-xs mt-4 animate-pulse" style={{ color: '#FF6B6B' }}>
          Redirecting to Login page...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-950 text-red-400 p-3 rounded-xl text-xs font-semibold text-center border border-red-900">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Shop Name / ਦੁਕਾਨ ਦਾ ਨਾਮ</label>
        <input
          type="text"
          placeholder="e.g. Sher-E-Punjab Store"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Owner Name / ਮਾਲਕ ਦਾ ਨਾਮ</label>
        <input
          type="text"
          placeholder="e.g. Sonu Sandhu"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Mobile / ਮੋਬਾਈਲ</label>
          <input
            type="tel"
            placeholder="e.g. 9876543210"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email / ਈਮੇਲ (Optional)</label>
          <input
            type="email"
            placeholder="e.g. owner@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Password / ਪਾਸਵਰਡ</label>
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Business Type / ਕਾਰੋਬਾਰ ਦੀ ਕਿਸਮ</label>
        <select
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value as BusinessType)}
          className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-primary text-sm"
        >
          <option value={BusinessType.GENERAL_STORE}>General Store (ਆਮ ਜਨਰਲ ਸਟੋਰ)</option>
          <option value={BusinessType.GROCERY}>Grocery Store (ਕਰਿਆਨਾ ਸਟੋਰ)</option>
          <option value={BusinessType.MEDICAL}>Chemist / Pharmacy (ਮੈਡੀਕਲ ਸਟੋਰ)</option>
          <option value={BusinessType.GARMENTS}>Garments & Apparel (ਕੱਪੜਿਆਂ ਦੀ ਦੁਕਾਨ)</option>
          <option value={BusinessType.ELECTRONICS}>Electronics (ਇਲੈਕਟ੍ਰਾਨਿਕਸ)</option>
          <option value={BusinessType.WHOLESALE}>Wholesale Merchant (ਥੋਕ ਵਪਾਰੀ)</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full text-white font-bold py-3 rounded-xl transition duration-200 hover:bg-opacity-90 mt-4 text-sm"
        style={{ backgroundColor: '#FF6B6B' }}
      >
        {loading ? 'Processing Onboarding...' : 'Start 14-Day Free Trial / ਰਜਿਸਟਰ ਕਰੋ'}
      </button>

      <div className="text-center mt-4">
        <Link href="/" className="text-xs text-gray-500 hover:text-primary transition duration-150">
          Already registered? Back to Login
        </Link>
      </div>
    </form>
  );
}
