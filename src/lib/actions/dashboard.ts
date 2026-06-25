'use server';

import { prisma } from '../../db/prisma';
import { getCurrentUser } from './auth';
import { Prisma } from '@prisma/client';
import { StockAlertRepository } from '../../db/repositories/StockAlertRepository';

export async function getDashboardStatsAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const shopId = user.shopId;

  // Time boundaries for Today (local time)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // 1. Today Sales
  const salesAggregate = await prisma.sale.aggregate({
    where: {
      shopId,
      date: {
        gte: todayStart,
        lte: todayEnd,
      },
      isReversed: false,
    },
    _sum: {
      total: true,
    },
  });
  const todaySales = salesAggregate._sum.total?.toNumber() || 0;

  // 2. Today Profit
  const todaySaleItems = await prisma.saleItem.findMany({
    where: {
      sale: {
        shopId,
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
        isReversed: false,
      },
    },
    select: {
      quantity: true,
      sellingPrice: true,
      purchasePrice: true,
    },
  });

  let todayProfit = 0;
  for (const item of todaySaleItems) {
    const qty = item.quantity.toNumber();
    const sell = item.sellingPrice.toNumber();
    const cost = item.purchasePrice.toNumber();
    todayProfit += qty * (sell - cost);
  }

  // Deduct today's cash expenses from profit calculation if they exist
  const todayExpenses = await prisma.expense.aggregate({
    where: {
      shopId,
      date: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
    _sum: {
      amount: true,
    },
  });
  const todayExpensesSum = todayExpenses._sum.amount?.toNumber() || 0;
  todayProfit = Math.max(0, todayProfit - todayExpensesSum);

  // 3. Inventory Value (Total cost of goods in stock)
  const products = await prisma.product.findMany({
    where: {
      shopId,
      isDeleted: false,
    },
    select: {
      currentQuantity: true,
      purchasePrice: true,
      minStock: true,
    },
  });

  let inventoryValue = 0;
  let lowStockCount = 0;

  for (const p of products) {
    const qty = p.currentQuantity.toNumber();
    const cost = p.purchasePrice.toNumber();
    const min = p.minStock.toNumber();

    inventoryValue += qty * cost;
    if (qty <= min) {
      lowStockCount++;
    }
  }

  // 4. Pending Customer Balance (Udhaar)
  const customersAggregate = await prisma.customer.aggregate({
    where: {
      shopId,
      isDeleted: false,
      currentBalance: {
        gt: 0,
      },
    },
    _sum: {
      currentBalance: true,
    },
    _count: {
      id: true,
    },
  });
  const pendingCustomerBalance = customersAggregate._sum.currentBalance?.toNumber() || 0;
  const customerCount = customersAggregate._count.id || 0;

  // 4b. Pending Supplier Outstanding Balance (Dues owed)
  const suppliersAggregate = await prisma.supplier.aggregate({
    where: {
      shopId,
      isDeleted: false,
      currentBalance: {
        gt: 0,
      },
    },
    _sum: {
      currentBalance: true,
    },
    _count: {
      id: true,
    },
  });
  const pendingSupplierBalance = suppliersAggregate._sum.currentBalance?.toNumber() || 0;
  const supplierCount = suppliersAggregate._count.id || 0;

  // Trigger low stock check dynamically to ensure alert data is current
  await StockAlertRepository.triggerLowStockCheck(shopId);

  // 5. Sales Trend (Last 7 Days)
  const salesTrend = [];
  for (let i = 6; i >= 0; i--) {
    const dStart = new Date();
    dStart.setDate(dStart.getDate() - i);
    dStart.setHours(0, 0, 0, 0);

    const dEnd = new Date();
    dEnd.setDate(dEnd.getDate() - i);
    dEnd.setHours(23, 59, 59, 999);

    const aggregate = await prisma.sale.aggregate({
      where: {
        shopId,
        date: {
          gte: dStart,
          lte: dEnd,
        },
        isReversed: false,
      },
      _sum: {
        total: true,
      },
    });

    const dayNamePa = dStart.toLocaleDateString('pa-IN', { weekday: 'short' });
    const dayNameEn = dStart.toLocaleDateString('en-US', { weekday: 'short' });

    salesTrend.push({
      dateStr: dStart.toISOString().slice(0, 10),
      dayEn: dayNameEn,
      dayPa: dayNamePa,
      amount: aggregate._sum.total?.toNumber() || 0,
    });
  }

  // 6. Top Selling Products
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

  // 7. Recent Transactions
  const recentSales = await prisma.sale.findMany({
    where: { shopId },
    orderBy: { date: 'desc' },
    take: 5,
    include: { customer: true },
  });

  const recentTransactions = recentSales.map((sale) => ({
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    customerName: sale.customer?.name || 'Walk-in Customer',
    total: sale.total.toNumber(),
    method: sale.paymentMethod,
    isReversed: sale.isReversed,
    date: sale.date,
  }));

  return {
    cards: {
      todaySales,
      todayProfit,
      inventoryValue,
      lowStockCount,
      pendingCustomerBalance,
      customerCount,
      pendingSupplierBalance,
      supplierCount,
    },
    widgets: {
      salesTrend,
      topProducts,
      recentTransactions,
    },
  };
}
