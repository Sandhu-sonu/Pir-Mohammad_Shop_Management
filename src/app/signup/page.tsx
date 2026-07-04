import React from 'react';
import SignupForm from './SignupForm';

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">PRMS Portal</h1>
        <p className="mt-2 text-sm text-gray-400">
          ਸ਼ੇਰ-ਏ-ਪੰਜਾਬ ਰਿਟੇਲ ਮੈਨੇਜਮੈਂਟ ਸਿਸਟਮ (SaaS Signup)
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-gray-900 py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-gray-800">
          <SignupForm />
        </div>
      </div>
    </div>
  );
}
