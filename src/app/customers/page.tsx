import { getCurrentUser } from '../../lib/actions/auth';
import { getCustomersAction } from '../../lib/actions/customers';
import { redirect } from 'next/navigation';
import Shell from '../../components/layout/Shell';
import CustomersClient from './CustomersClient';

interface PageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

export const revalidate = 0;

export default async function CustomersPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  const params = await searchParams;
  const search = params.search || '';
  const page = parseInt(params.page || '1', 10);

  const customersData = await getCustomersAction({
    search,
    page,
    limit: 10,
  });

  return (
    <Shell userName={user.name} shopName={user.shopName || 'Punjab Shop'}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            ਗਾਹਕ ਪ੍ਰਬੰਧਨ ਅਤੇ ਉਧਾਰ ਖਾਤਾ (Customers & Khata)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ਗਾਹਕਾਂ ਦੀ ਸੂਚੀ, ਨਵੇਂ ਖਾਤੇ ਬਣਾਓ, ਬਕਾਇਆ ਉਧਾਰ ਅਤੇ ਜਮ੍ਹਾਂ (Dues, Ledgers, and Payments)
          </p>
        </div>

        <CustomersClient
          customersData={customersData}
          currentFilters={{
            search,
            page,
          }}
        />
      </div>
    </Shell>
  );
}
