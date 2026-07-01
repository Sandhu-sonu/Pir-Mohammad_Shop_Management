import { getCurrentUser } from '@/lib/actions/auth';
import { StockAlertRepository } from '@/db/repositories/StockAlertRepository';
import { SupplierRepository } from '@/db/repositories/SupplierRepository';
import { redirect } from 'next/navigation';
import LowStockClient from './LowStockClient';

export const revalidate = 0;

export default async function LowStockPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  const lowStockProducts = await StockAlertRepository.getLowStockList(user.shopId);
  const suppliers = await SupplierRepository.findAll(user.shopId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          ਘੱਟ ਸਟਾਕ ਅਲਰਟ (Low Stock Alerts)
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          ਆਈਟਮਾਂ ਜੋ ਰੀਆਰਡਰ ਪੱਧਰ ਤੋਂ ਘੱਟ ਹਨ। ਇੱਥੋਂ ਸਿੱਧੇ ਹੋਲਸੇਲਰ ਲਈ ਖਰੀਦ ਆਰਡਰ ਡਰਾਫਟ ਤਿਆਰ ਕਰੋ।
        </p>
      </div>

      <LowStockClient
        lowStockProducts={JSON.parse(JSON.stringify(lowStockProducts))}
        suppliers={JSON.parse(JSON.stringify(suppliers))}
      />
    </div>
  );
}

