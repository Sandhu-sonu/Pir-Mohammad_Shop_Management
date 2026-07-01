import { getCurrentUser } from '@/lib/actions/auth';
import { listExpensesAction, getExpenseSummaryAction } from '@/lib/actions/expenses';
import { redirect } from 'next/navigation';
import ExpensesClient from './ExpensesClient';

export const revalidate = 0;

export default async function ExpensesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  const expensesData = await listExpensesAction(1, 20);
  
  // Only Owner and Manager can view summary cards
  const summary = (user.role === 'OWNER' || user.role === 'MANAGER')
    ? await getExpenseSummaryAction()
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          ਖਰਚਾ ਪ੍ਰਬੰਧਨ (Expense Management)
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          ਦੁਕਾਨ ਦੇ ਰੋਜ਼ਾਨਾ ਖਰਚੇ ਜਿਵੇਂ ਕਿਰਾਇਆ, ਬਿਜਲੀ, ਤਨਖਾਹ ਆਦਿ ਦਰਜ ਕਰੋ (Salary, Rent, Bills)
        </p>
      </div>

      <ExpensesClient
        expensesData={expensesData}
        summary={summary}
        currentUserRole={user.role}
        currentUserId={user.userId}
      />
    </div>
  );
}

