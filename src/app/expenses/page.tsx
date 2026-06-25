import { getCurrentUser } from '../../lib/actions/auth';
import { listExpensesAction, getExpenseSummaryAction } from '../../lib/actions/expenses';
import { redirect } from 'next/navigation';
import Shell from '../../components/layout/Shell';
import ExpensesClient from './ExpensesClient';

export const revalidate = 0;

export default async function ExpensesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  const expensesData = await listExpensesAction(1, 20);
  const summary = await getExpenseSummaryAction();

  return (
    <Shell userName={user.name} shopName="Sher-E-Punjab Retail">
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
        />
      </div>
    </Shell>
  );
}
