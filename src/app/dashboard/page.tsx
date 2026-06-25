import { getCurrentUser } from '../../lib/actions/auth';
import { getDashboardStatsAction } from '../../lib/actions/dashboard';
import { redirect } from 'next/navigation';
import Shell from '../../components/layout/Shell';
import DashboardClient from './DashboardClient';
import Link from 'next/link';

export const revalidate = 0; // Disable caching to fetch real-time updates

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  const stats = JSON.parse(JSON.stringify(await getDashboardStatsAction()));

  return (
    <Shell userName={user.name} shopName="Sher-E-Punjab Retail">
      <div className="space-y-6">
        
        {/* Dashboard Title & Closing Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              ਡੈਸ਼ਬੋਰਡ (Dashboard)
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ਅੱਜ ਦੀ ਦੁਕਾਨ ਦੀ ਕਾਰਗੁਜ਼ਾਰੀ ਅਤੇ ਸੰਖੇਪ (Real-time Shop Summary)
            </p>
          </div>
          
          <Link
            href="/dashboard/closing"
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-md font-bold shadow-md transition-all shrink-0 w-full sm:w-auto text-center"
          >
            ਰੋਜ਼ਾਨਾ ਕਲੋਜ਼ਿੰਗ (Daily Closing)
          </Link>
        </div>

        <DashboardClient stats={stats} />

      </div>
    </Shell>
  );
}
