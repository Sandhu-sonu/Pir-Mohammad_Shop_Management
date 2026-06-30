import { getCurrentUser } from '../../lib/actions/auth';
import { PurchaseRepository } from '../../db/repositories/PurchaseRepository';
import { SupplierRepository } from '../../db/repositories/SupplierRepository';
import { ProductRepository } from '../../db/repositories/ProductRepository';
import { redirect } from 'next/navigation';
import Shell from '../../components/layout/Shell';
import PurchasesClient from './PurchasesClient';

export const revalidate = 0;

export default async function PurchasesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  const purchases = await PurchaseRepository.findAll(user.shopId);
  const suppliers = await SupplierRepository.findAll(user.shopId);
  
  // Load products list for lookup during billing POS
  const productsResult = await ProductRepository.findAll({
    shopId: user.shopId,
    page: 1,
    limit: 1000,
  });

  return (
    <Shell userName={user.name} shopName={user.shopName || 'Punjab Shop'}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            ਖਰੀਦ ਬਿਲਿੰਗ POS (Purchase Orders & Returns)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ਨਵੀਂ ਖਰੀਦ ਦਰਜ ਕਰੋ, ਸਪਲਾਇਰਾਂ ਤੋਂ ਆਇਆ ਮਾਲ ਰਿਸੀਵ ਕਰੋ, ਅਤੇ ਖਰਾਬ ਸਮਾਨ ਦੀ ਵਾਪਸੀ (Purchase Invoices, Stocks & Returns POS)
          </p>
        </div>

        <PurchasesClient
          initialPurchases={JSON.parse(JSON.stringify(purchases))}
          suppliers={JSON.parse(JSON.stringify(suppliers))}
          products={JSON.parse(JSON.stringify(productsResult.items))}
        />
      </div>
    </Shell>
  );
}
