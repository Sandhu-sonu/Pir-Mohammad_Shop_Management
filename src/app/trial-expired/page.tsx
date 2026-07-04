import React from 'react';
import Link from 'next/link';

export default function TrialExpiredPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center p-6 text-center">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full">
        <div className="text-orange-500 text-6xl mb-4 font-bold">⏳</div>
        <h1 className="text-2xl font-extrabold text-white">ਟ੍ਰਾਇਲ ਖਤਮ ਹੋ ਗਿਆ (Trial Expired)</h1>
        <p className="text-gray-400 text-sm mt-3">
          ਤੁਹਾਡੀ ਦੁਕਾਨ ਦੀ ਸਬਸਕ੍ਰਿਪਸ਼ਨ/ਟ੍ਰਾਇਲ ਮਿਆਦ ਖਤਮ ਹੋ ਗਈ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੇ ਖਾਤੇ ਨੂੰ ਅਪਗ੍ਰੇਡ ਕਰੋ। (Your free trial or subscription period has expired. Please contact support or upgrade your plan to restore access.)
        </p>
        <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 text-left mt-6">
          <p className="text-xs text-gray-500 font-bold uppercase">ਸਹਾਇਤਾ ਕੇਂਦਰ (Helpdesk Support):</p>
          <p className="text-sm text-white mt-1">📧 support@sherpunjabpos.com</p>
          <p className="text-sm text-white">📞 +91 99999-99999</p>
        </div>
        <div className="mt-8">
          <Link href="/" className="inline-block bg-gray-800 hover:bg-gray-700 text-white font-bold px-6 py-3 rounded-xl transition duration-200 text-sm">
            Back to Login / ਲਾਗਇਨ
          </Link>
        </div>
      </div>
    </div>
  );
}
