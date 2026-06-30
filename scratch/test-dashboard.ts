import { prisma } from '../src/db/prisma';
import { Prisma } from '@prisma/client';

async function main() {
  console.log('Testing dashboard queries sequentially...');
  try {
    const shop = await prisma.shop.findFirst();
    if (!shop) {
      console.error('No shop found in database.');
      return;
    }
    const shopId = shop.id;
    console.log(`Using shopId: ${shopId}`);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    console.log('1. Querying daily closing status...');
    const todayClosing = await prisma.dailyClosing.findFirst({
      where: { shopId, date: todayStart, isReversed: false },
    });
    console.log(`- Today closed: ${!!todayClosing}`);

    console.log('2. Querying sales counts...');
    const todaySalesCount = await prisma.sale.count({
      where: { shopId, date: { gte: todayStart, lte: todayEnd }, isReversed: false },
    });
    console.log(`- Today sales count: ${todaySalesCount}`);

    console.log('3. Grouping unique customers...');
    const uniqueCustomersResult = await prisma.sale.groupBy({
      by: ['customerId'],
      where: {
        shopId,
        date: { gte: todayStart, lte: todayEnd },
        isReversed: false,
        customerId: { not: null },
      },
    });
    console.log(`- Customers served count: ${uniqueCustomersResult.length}`);

    console.log('4. Querying today sales revenue...');
    const salesAggregate = await prisma.sale.aggregate({
      where: { shopId, date: { gte: todayStart, lte: todayEnd }, isReversed: false },
      _sum: { total: true },
    });
    console.log(`- Today sales total: ${salesAggregate._sum.total?.toString() || '0'}`);

    console.log('5. Querying low stock count...');
    const lowStockCount = await prisma.product.count({
      where: {
        shopId,
        isDeleted: false,
        currentQuantity: {
          lte: prisma.product.fields.minStock,
        },
      },
    });
    console.log(`- Low stock count: ${lowStockCount}`);

    console.log('6. Querying outstanding balances...');
    const [customerBalResult, supplierBalResult] = await Promise.all([
      prisma.customer.aggregate({
        where: { shopId, isDeleted: false, currentBalance: { gt: 0 } },
        _sum: { currentBalance: true },
      }),
      prisma.supplier.aggregate({
        where: { shopId, isDeleted: false, currentBalance: { gt: 0 } },
        _sum: { currentBalance: true },
      }),
    ]);
    console.log(`- Customer outstanding: ${customerBalResult._sum.currentBalance?.toString() || '0'}`);
    console.log(`- Supplier outstanding: ${supplierBalResult._sum.currentBalance?.toString() || '0'}`);

    console.log('7. Querying closing metrics...');
    const lastActiveClosing = await prisma.dailyClosing.findFirst({
      where: { shopId, isReversed: false },
      orderBy: { date: 'desc' },
    });
    console.log(`- Last active closing closingCash: ${lastActiveClosing?.closingCash?.toString() || '0'}`);

    console.log('8. Querying sales trends (last 7 days)...');
    for (let i = 6; i >= 0; i--) {
      const dStart = new Date();
      dStart.setDate(dStart.getDate() - i);
      dStart.setHours(0, 0, 0, 0);

      const dEnd = new Date();
      dEnd.setDate(dEnd.getDate() - i);
      dEnd.setHours(23, 59, 59, 999);

      const trendAggregate = await prisma.sale.aggregate({
        where: { shopId, date: { gte: dStart, lte: dEnd }, isReversed: false },
        _sum: { total: true },
      });
      console.log(`- Day -${i} sales total: ${trendAggregate._sum.total?.toString() || '0'}`);
    }

    console.log('9. Querying top selling products...');
    const saleItemsGrouped = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { shopId, isReversed: false } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });
    console.log(`- Top items count: ${saleItemsGrouped.length}`);

    console.log('10. Querying recent transactions...');
    const recentSales = await prisma.sale.findMany({
      where: { shopId },
      orderBy: { date: 'desc' },
      take: 5,
      include: { customer: true },
    });
    console.log(`- Recent transactions count: ${recentSales.length}`);

    console.log('All dashboard queries executed successfully without crashes!');
  } catch (err: any) {
    console.error('CRITICAL ERROR DURING QUERY EXECUTION:');
    console.error(err);
    process.exit(1);
  }
}

main().then(() => prisma.$disconnect());
