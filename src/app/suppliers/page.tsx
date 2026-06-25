import { getCurrentUser } from '../../lib/actions/auth';
import { SupplierRepository } from '../../db/repositories/SupplierRepository';
import { redirect } from 'next/navigation';
import Shell from '../../components/layout/Shell';
import SuppliersClient from './SuppliersClient';

export const revalidate = 0;

export default async function SuppliersPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  const suppliers = await SupplierRepository.findAll(user.shopId);

  return (
    <Shell userName={user.name} shopName="Sher-E-Punjab Retail">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            ਸਪਲਾਇਰ ਖਾਤਾ (Supplier Khata & Profiles)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ਹੋਲਸੇਲਰਾਂ ਦੇ ਖਾਤੇ, ਪੈਂਡਿੰਗ ਦੇਣਦਾਰੀ, ਅਤੇ ਭੁਗਤਾਨ ਦਾ ਹਿਸਾਬ-ਕਿਤਾਬ (Suppliers Ledger, Outstanding Balance & Payments)
          </p>
        </div>

        <SuppliersClient
          initialSuppliers={JSON.parse(JSON.stringify(suppliers))}
        />
      </div>
    </Shell>
  );
}
