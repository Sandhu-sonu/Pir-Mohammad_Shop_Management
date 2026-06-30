import { getCurrentUser } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';
import ReportsClient from './ReportsClient';

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  // Restrict to OWNER and MANAGER
  if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="bg-red-50 dark:bg-red-950/30 p-6 rounded-2xl max-w-md border border-red-100 dark:border-red-900/50">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">
            ਪਹੁੰਚ ਤੋਂ ਬਾਹਰ (Permission Denied)
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Only Owners and Managers are authorized to view reports and business analytics.
          </p>
        </div>
      </div>
    );
  }

  return <ReportsClient userRole={user.role} />;
}
