import { getCurrentUser } from '@/lib/actions/auth';
import { listSalesAction } from '@/lib/actions/sales';
import { CustomerRepository } from '@/db/repositories/CustomerRepository';
import { prisma } from '@/db/prisma';
import { redirect } from 'next/navigation';
import SalesClient from './SalesClient';

export const revalidate = 0;

export default async function SalesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  // Load all available products for cart selection
  const products = await prisma.product.findMany({
    where: {
      shopId: user.shopId,
      isDeleted: false,
    },
    orderBy: {
      nameEn: 'asc',
    },
  });

  // Load active customers for POS customer select
  const customers = await CustomerRepository.findAll({
    shopId: user.shopId,
    limit: 100, // Load initial subset for selection
  });

  // Load recent invoices
  const salesData = await listSalesAction(1, 10);

  // Load shop with regional & printer settings
  const shop = await prisma.shop.findUnique({
    where: { id: user.shopId },
    include: { settings: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          ਨਵੀਂ ਵਿਕਰੀ ਅਤੇ POS ਬਿੱਲ (Sales & Invoicing)
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          ਤੇਜ਼ੀ ਨਾਲ ਬਿੱਲ ਬਣਾਓ, ਪ੍ਰਿੰਟ ਕਰੋ, ਅਤੇ ਹਾਲੀਆ ਵਿਕਰੀਆਂ ਦੇਖੋ (POS billing terminal)
        </p>
      </div>

      <SalesClient
        products={JSON.parse(JSON.stringify(products))}
        customers={JSON.parse(JSON.stringify(customers.items))}
        salesData={salesData}
        shop={JSON.parse(JSON.stringify(shop))}
        role={user.role}
      />
    </div>
  );
}

