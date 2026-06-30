import { getCurrentUser } from '../../../lib/actions/auth';
import { getClosingForDateAction, calculateClosingMetricsAction } from '../../../lib/actions/closing';
import { redirect } from 'next/navigation';
import Shell from '../../../components/layout/Shell';
import ClosingForm from './ClosingForm';

export const revalidate = 0;

export default async function DailyClosingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  // Permission Guard: Only Owner and Manager are allowed to access Daily Closing
  if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
    return (
      <Shell userName={user.name} shopName={user.shopName || 'Punjab Shop'}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <div className="bg-red-50 dark:bg-red-950/30 p-8 rounded-2xl max-w-md border border-red-100 dark:border-red-900/50 shadow-sm">
            <h1 className="text-2xl font-black text-red-600 dark:text-red-400 mb-2">
              ਪਹੁੰਚ ਤੋਂ ਬਾਹਰ (Permission Denied)
            </h1>
            <p className="text-zinc-650 dark:text-zinc-400 text-sm">
              Only Owners and Managers are authorized to verify, lock, or reverse daily closing balances.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  
  // Load metrics calculated for today
  const metrics = await calculateClosingMetricsAction(todayStr);
  const existingClosing = await getClosingForDateAction(todayStr);

  return (
    <Shell userName={user.name} shopName={user.shopName || 'Punjab Shop'}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            ਰੋਜ਼ਾਨਾ ਕਲੋਜ਼ਿੰਗ ਰਜਿਸਟਰ (Daily Closing)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ਗੱਲੇ ਦੀ ਨਕਦ ਰਾਸ਼ੀ ਦਾ ਮੇਲ-ਜੋਲ (Verify and close today's physical cash balances)
          </p>
        </div>

        <ClosingForm 
          metrics={metrics} 
          existingClosing={existingClosing} 
          dateString={todayStr} 
          currentUserId={user.userId}
          currentUserRole={user.role}
        />
      </div>
    </Shell>
  );
}
