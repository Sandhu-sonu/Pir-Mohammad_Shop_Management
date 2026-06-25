import { getCurrentUser } from '../../lib/actions/auth';
import { getProductsAction, getCategoriesAction } from '../../lib/actions/inventory';
import { SupplierRepository } from '../../db/repositories/SupplierRepository';
import { redirect } from 'next/navigation';
import Shell from '../../components/layout/Shell';
import InventoryClient from './InventoryClient';

interface PageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    lowStock?: string;
    page?: string;
  }>;
}

export const revalidate = 0;

export default async function InventoryPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  const params = await searchParams;
  const search = params.search || '';
  const category = params.category || 'ALL';
  const lowStockOnly = params.lowStock === 'true';
  const page = parseInt(params.page || '1', 10);

  const productsData = await getProductsAction({
    search,
    category,
    lowStockOnly,
    page,
    limit: 10,
  });

  const categories = await getCategoriesAction();
  const suppliers = await SupplierRepository.findAll(user.shopId);

  return (
    <Shell userName={user.name} shopName="Sher-E-Punjab Retail">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            ਸਟਾਕ ਪ੍ਰਬੰਧਨ (Inventory Management)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ਨਵੇਂ ਉਤਪਾਦ ਜੋੜੋ, ਸਟਾਕ ਚੈੱਕ ਕਰੋ, ਬਾਰਕੋਡ ਅਤੇ ਰਿਪੋਰਟਾਂ (Products and Stock Movements)
          </p>
        </div>

        <InventoryClient
          productsData={JSON.parse(JSON.stringify(productsData))}
          categories={categories}
          suppliers={JSON.parse(JSON.stringify(suppliers))}
          currentFilters={{
            search,
            category,
            lowStockOnly,
            page,
          }}
        />
      </div>
    </Shell>
  );
}
