import React from 'react';
import Link from 'next/link';

export default function SuspendedPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center p-6 text-center">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full">
        <div className="text-red-500 text-6xl mb-4 font-bold">⚠️</div>
        <h1 className="text-2xl font-extrabold text-white">ਖਾਤਾ ਮੁਅੱਤਲ ਕੀਤਾ ਗਿਆ (Account Suspended)</h1>
        <p className="text-gray-400 text-sm mt-3">
          ਤੁਹਾਡੀ ਦੁਕਾਨ ਦਾ ਖਾਤਾ ਸੁਰੱਖਿਆ ਜਾਂ ਭੁਗਤਾਨ ਕਾਰਨਾਂ ਕਰਕੇ ਅਸਥਾਈ ਤੌਰ ਤੇ ਮੁਅੱਤਲ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ। (Your shop account has been temporarily suspended by the system administrator.)
        </p>
        <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 text-left mt-6">
          <p className="text-xs text-gray-500 font-bold uppercase">ਸੰਪਰਕ ਸਹਾਇਤਾ (Contact Support):</p>
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
