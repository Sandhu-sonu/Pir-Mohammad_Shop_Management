'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '../validation';
import { login } from '../lib/actions/auth';
import { z } from 'zod';

type LoginInputs = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginInputs>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      mobile: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginInputs) => {
    setLoading(true);
    setError(null);
    try {
      const res = await login(data.mobile, data.password);
      if (res.success) {
        router.refresh();
        router.push('/dashboard');
      } else {
        setError(res.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login request failed:', err);
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      {error && (
        <div className="bg-red-950/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg text-sm font-semibold">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="mobile" className="block text-sm font-bold text-slate-350">
          ਮੋਬਾਈਲ ਜਾਂ ਯੂਜ਼ਰਨੇਮ (Mobile / Username)
        </label>
        <div className="mt-2">
          <input
            id="mobile"
            type="text"
            {...register('mobile')}
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            placeholder="e.g. admin or 9876543210"
          />
          {errors.mobile && (
            <p className="mt-1 text-xs text-red-400 font-medium">{errors.mobile.message}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-bold text-slate-350">
          ਪਾਸਵਰਡ (Password)
        </label>
        <div className="mt-2">
          <input
            id="password"
            type="password"
            {...register('password')}
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            placeholder="••••••"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-400 font-medium">{errors.password.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-lg shadow-sm text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? 'ਲੌਗਇਨ ਹੋ ਰਿਹਾ ਹੈ...' : 'ਲੌਗਇਨ ਕਰੋ (Login)'}
        </button>

        <div className="text-center pt-2">
          <Link href="/signup" className="text-xs text-blue-400 hover:text-blue-500 font-bold transition-all">
            New Business? Start a 14-day free trial / ਰਜਿਸਟਰ ਕਰੋ
          </Link>
        </div>
      </div>
    </form>
  );
}
