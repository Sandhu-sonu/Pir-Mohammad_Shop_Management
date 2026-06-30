'use server';

import { prisma } from '../../db/prisma';
import { getCurrentUser } from './auth';
import { Prisma } from '@prisma/client';
import { StockAlertRepository } from '../../db/repositories/StockAlertRepository';
import { DailyClosingRepository } from '../../db/repositories/DailyClosingRepository';
import { ProfitService } from '../../db/services/ProfitService';

export async function getDashboardStatsAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const shopId = user.shopId;

  // Time boundaries for Today (local time)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Check today's daily closing status
  const todayClosing = await DailyClosingRepository.getClosingForDate(shopId, todayStart, false);
  const isClosedToday = !!todayClosing;

  // 1. Common KPIs (Sales Count & Customers Count)
  const [todaySalesCount, uniqueCustomersResult] = await Promise.all([
    prisma.sale.count({
      where: {
        shopId,
        date: { gte: todayStart, lte: todayEnd },
        isReversed: false,
      },
    }),
    prisma.sale.groupBy({
      by: ['customerId'],
      where: {
        shopId,
        date: { gte: todayStart, lte: todayEnd },
        isReversed: false,
        customerId: { not: null },
      },
    }),
  ]);
  const customersServedCount = uniqueCustomersResult.length;

  // 2. Today's Sales Revenue
  const salesAggregate = await prisma.sale.aggregate({
    where: {
      shopId,
      date: { gte: todayStart, lte: todayEnd },
      isReversed: false,
    },
    _sum: {
      total: true,
    },
  });
  const todaySalesVal = salesAggregate._sum.total?.toNumber() || 0;

  // If user is STAFF or VIEW_ONLY, return restricted cashier dashboard dashboard data
  if (user.role === 'STAFF' || user.role === 'VIEW_ONLY') {
    return {
      role: user.role,
      cards: {
        todaySales: todaySalesVal,
        billsCreated: todaySalesCount,
        customersServed: customersServedCount,
        isClosedToday,
      },
      widgets: {
        recentTransactions: await getRecentTransactions(shopId),
      },
    };
  }

  // Owner/Manager FULL Dashboard Stats
  // 3. Dynamic Profit Calculation
  const profitStats = await ProfitService.calculateProfit(shopId, todayStart, todayEnd);

  // 4. Low stock count
  await StockAlertRepository.triggerLowStockCheck(shopId);
  const lowStockCount = await prisma.product.count({
    where: {
      shopId,
      isDeleted: false,
      currentQuantity: {
        lte: prisma.product.fields.minStock,
      },
    },
  });

  // 5. Outstanding Balances
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

  const customerOutstanding = customerBalResult._sum.currentBalance?.toNumber() || 0;
  const supplierOutstanding = supplierBalResult._sum.currentBalance?.toNumber() || 0;

  // 6. Cash Available in Hand right now
  const closingMetrics = await DailyClosingRepository.calculateClosingMetrics(shopId, todayStart);
  // Expected Cash = Opening + Cash Sales + Customer Cash Recoveries - Cash Expenses - Supplier Cash Payments - Withdrawals
  const expectedCashVal =
    closingMetrics.suggestedOpeningCash +
    closingMetrics.salesCash +
    closingMetrics.paymentsReceivedCash -
    closingMetrics.expensesCash -
    closingMetrics.supplierPaymentsCash;

  const cashAvailable = todayClosing ? todayClosing.closingCash.toNumber() : expectedCashVal;

  // 7. Business Health Index
  // Inputs: Profit, Expense Ratio, Cash Difference, Low Stock
  const expenseRatio = todaySalesVal > 0 ? profitStats.expenses / todaySalesVal : 0;
  const cashDifference = todayClosing ? Math.abs(todayClosing.difference.toNumber()) : 0;

  let healthScore: 'EXCELLENT' | 'GOOD' | 'ATTENTION' | 'CRITICAL' = 'GOOD';
  if (profitStats.netProfit <= -1000 || lowStockCount > 15 || cashDifference > 500) {
    healthScore = 'CRITICAL';
  } else if (profitStats.netProfit <= 0 || lowStockCount > 5 || cashDifference > 100) {
    healthScore = 'ATTENTION';
  } else if (profitStats.netProfit > 0 && expenseRatio < 0.2 && cashDifference === 0 && lowStockCount === 0) {
    healthScore = 'EXCELLENT';
  }

  // 8. Sales Trend (Last 7 Days)
  const salesTrend = [];
  for (let i = 6; i >= 0; i--) {
    const dStart = new Date();
    dStart.setDate(dStart.getDate() - i);
    dStart.setHours(0, 0, 0, 0);

    const dEnd = new Date();
    dEnd.setDate(dEnd.getDate() - i);
    dEnd.setHours(23, 59, 59, 999);

    const trendAggregate = await prisma.sale.aggregate({
      where: {
        shopId,
        date: { gte: dStart, lte: dEnd },
        isReversed: false,
      },
      _sum: { total: true },
    });

    const dayNamePa = dStart.toLocaleDateString('pa-IN', { weekday: 'short' });
    const dayNameEn = dStart.toLocaleDateString('en-US', { weekday: 'short' });

    salesTrend.push({
      dateStr: dStart.toISOString().slice(0, 10),
      dayEn: dayNameEn,
      dayPa: dayNamePa,
      amount: trendAggregate._sum.total?.toNumber() || 0,
    });
  }

  // 9. Top Selling Products
  const saleItemsGrouped = await prisma.saleItem.groupBy({
    by: ['productId'],
    where: {
      sale: {
        shopId,
        isReversed: false,
      },
    },
    _sum: {
      quantity: true,
      total: true,
    },
    orderBy: {
      _sum: {
        quantity: 'desc',
      },
    },
    take: 5,
  });

  const topProducts = [];
  for (const item of saleItemsGrouped) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: { nameEn: true, namePa: true, unit: true },
    });
    if (product) {
      topProducts.push({
        id: item.productId,
        nameEn: product.nameEn,
        namePa: product.namePa,
        unit: product.unit,
        totalQty: item._sum.quantity?.toNumber() || 0,
        totalSales: item._sum.total?.toNumber() || 0,
      });
    }
  }

  // 10. Additional Version 1.0 RC1 Metrics
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [totalProducts, monthlySalesAggregate, lastBackup] = await Promise.all([
    prisma.product.count({
      where: { shopId, isDeleted: false },
    }),
    prisma.sale.aggregate({
      where: {
        shopId,
        date: { gte: monthStart },
        isReversed: false,
      },
      _sum: { total: true },
    }),
    prisma.backupHistory.findFirst({
      where: { shopId, status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  const monthlySales = monthlySalesAggregate._sum.total?.toNumber() || 0;
  const lastBackupTime = lastBackup?.createdAt ? lastBackup.createdAt.toISOString() : null;

  return {
    role: user.role,
    cards: {
      todaySales: todaySalesVal,
      todayProfit: profitStats.netProfit,
      todayExpenses: profitStats.expenses,
      cashAvailable,
      customerOutstanding,
      supplierOutstanding,
      lowStockCount,
      healthScore,
      totalProducts,
      monthlySales,
      lastBackupTime,
    },
    widgets: {
      salesTrend,
      topProducts,
      recentTransactions: await getRecentTransactions(shopId),
    },
  };
}

async function getRecentTransactions(shopId: string) {
  const recentSales = await prisma.sale.findMany({
    where: { shopId },
    orderBy: { date: 'desc' },
    take: 5,
    include: { customer: true },
  });

  return recentSales.map((sale) => ({
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    customerName: sale.customer?.name || 'Walk-in Customer',
    total: sale.total.toNumber(),
    method: sale.paymentMethod,
    isReversed: sale.isReversed,
    date: sale.date,
  }));
}
