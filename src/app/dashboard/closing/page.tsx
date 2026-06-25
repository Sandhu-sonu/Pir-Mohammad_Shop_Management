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

  const todayStr = new Date().toISOString().slice(0, 10);
  
  // Load metrics calculated for today
  const metrics = await calculateClosingMetricsAction(todayStr);
  const existingClosing = await getClosingForDateAction(todayStr);

  return (
    <Shell userName={user.name} shopName="Sher-E-Punjab Retail">
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
        />
      </div>
    </Shell>
  );
}
