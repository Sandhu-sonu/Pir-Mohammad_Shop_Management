import { getCurrentUser } from '../../../lib/actions/auth';
import { getCustomerProfileAction, getCustomerLedgerAction } from '../../../lib/actions/customers';
import { redirect } from 'next/navigation';
import Shell from '../../../components/layout/Shell';
import CustomerProfileClient from './CustomerProfileClient';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export const revalidate = 0;

export default async function CustomerDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  const resolvedParams = await params;
  const profile = await getCustomerProfileAction(resolvedParams.id);
  const ledger = await getCustomerLedgerAction(resolvedParams.id);

  return (
    <Shell userName={user.name} shopName="Sher-E-Punjab Retail">
      <CustomerProfileClient
        profile={profile}
        ledger={ledger}
        customerId={resolvedParams.id}
      />
    </Shell>
  );
}
