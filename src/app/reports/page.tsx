import { getCurrentUser } from '../../lib/actions/auth';
import { prisma } from '../../db/prisma';
import { redirect } from 'next/navigation';
import Shell from '../../components/layout/Shell';
import ReportsClient from './ReportsClient';

export const revalidate = 0;

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  const shopId = user.shopId;

  // 1. Sales Report: Grouped by date (last 30 days)
  const salesByDate = await prisma.sale.groupBy({
    by: ['date'],
    where: { shopId, isReversed: false },
    _sum: {
      total: true,
      paidAmount: true,
      dueAmount: true,
    },
    orderBy: {
      date: 'desc',
    },
    take: 30,
  });

  const formattedSalesByDate = salesByDate.map((s) => ({
    date: s.date.toISOString().slice(0, 10),
    total: s._sum.total?.toNumber() || 0,
    paid: s._sum.paidAmount?.toNumber() || 0,
    due: s._sum.dueAmount?.toNumber() || 0,
  }));

  // 2. Inventory Report: Product valuation & margins
  const products = await prisma.product.findMany({
    where: { shopId, isDeleted: false },
    select: {
      sku: true,
      nameEn: true,
      namePa: true,
      currentQuantity: true,
      purchasePrice: true,
      sellingPrice: true,
      unit: true,
    },
    orderBy: {
      nameEn: 'asc',
    },
  });

  const formattedInventory = products.map((p) => {
    const qty = p.currentQuantity.toNumber();
    const purchase = p.purchasePrice.toNumber();
    const selling = p.sellingPrice.toNumber();
    return {
      sku: p.sku || '-',
      nameEn: p.nameEn,
      namePa: p.namePa,
      quantity: qty,
      unit: p.unit,
      purchasePrice: purchase,
      sellingPrice: selling,
      totalValue: qty * purchase,
      potentialSales: qty * selling,
      margin: selling - purchase,
    };
  });

  // 3. Customer Due Report: Customers with outstanding dues
  const customersDues = await prisma.customer.findMany({
    where: {
      shopId,
      isDeleted: false,
      currentBalance: {
        gt: 0,
      },
    },
    select: {
      name: true,
      mobile: true,
      currentBalance: true,
    },
    orderBy: {
      currentBalance: 'desc',
    },
  });

  const formattedCustomerDues = customersDues.map((c) => ({
    name: c.name,
    mobile: c.mobile || '-',
    dueAmount: c.currentBalance.toNumber(),
  }));

  // 4. Fast & Slow Moving Items
  const itemsSolds = await prisma.saleItem.groupBy({
    by: ['productId'],
    where: {
      sale: {
        shopId,
        isReversed: false,
      },
    },
    _sum: {
      quantity: true,
    },
    orderBy: {
      _sum: {
        quantity: 'desc',
      },
    },
  });

  const salesQuantities = new Map(itemsSolds.map((item) => [item.productId, item._sum.quantity?.toNumber() || 0]));

  const allProductsForSpeeds = await prisma.product.findMany({
    where: { shopId, isDeleted: false },
    select: { id: true, nameEn: true, namePa: true, unit: true },
  });

  const productsWithSales = allProductsForSpeeds.map((p) => ({
    nameEn: p.nameEn,
    namePa: p.namePa,
    unit: p.unit,
    qtySold: salesQuantities.get(p.id) || 0,
  }));

  const fastMoving = [...productsWithSales].sort((a, b) => b.qtySold - a.qtySold).slice(0, 10);
  const slowMoving = [...productsWithSales].sort((a, b) => a.qtySold - b.qtySold).slice(0, 10);

  return (
    <Shell userName={user.name} shopName="Sher-E-Punjab Retail">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            ਰਿਪੋਰਟਾਂ ਅਤੇ ਵਿਸ਼ਲੇਸ਼ਣ (Reports & Analytics)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ਵਿਕਰੀ, ਉਧਾਰ, ਮੁਨਾਫਾ ਅਤੇ ਉਤਪਾਦਾਂ ਦੀ ਕਾਰਗੁਜ਼ਾਰੀ ਰਿਪੋਰਟ (Business Performance Records)
          </p>
        </div>

        <ReportsClient
          salesReport={formattedSalesByDate}
          inventoryReport={formattedInventory}
          duesReport={formattedCustomerDues}
          fastMoving={fastMoving}
          slowMoving={slowMoving}
        />
      </div>
    </Shell>
  );
}
