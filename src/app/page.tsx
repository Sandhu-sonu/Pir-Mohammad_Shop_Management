import { getCurrentUser } from '../lib/actions/auth';
import { redirect } from 'next/navigation';
import LoginForm from './LoginForm';

export default async function LoginPage() {
  const user = await getCurrentUser();

  // If already authenticated, redirect to Dashboard
  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-900 text-slate-100 font-sans min-h-screen">
      <div className="sm:mx-auto sm:w-full sm:max-max-w-md text-center px-4">
        <h1 className="text-3xl font-extrabold text-blue-400">
          ਪੰਜਾਬ ਦੁਕਾਨ ਪ੍ਰਬੰਧਕ
        </h1>
        <h2 className="text-lg font-medium text-slate-400 mt-2">
          Punjab Shop Management System
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-slate-800 py-8 px-4 shadow-xl rounded-2xl sm:px-10 border border-slate-700">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
