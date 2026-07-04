import { NextResponse } from 'next/server';
import { prisma } from '@/db/prisma';
import { getCurrentUser } from '@/lib/actions/auth';
import { DailyClosingRepository } from '@/db/repositories/DailyClosingRepository';
import { ProfitService } from '@/db/services/ProfitService';
import { Role } from '@prisma/client';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== Role.OWNER) {
      return NextResponse.json({ success: false, error: 'Forbidden: Owner access only' }, { status: 403 });
    }

    const shopId = user.shopId;

    // Time boundaries (local day)
    const now = new Date();
    
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(todayEnd);

    // 1. Sales Aggregates
    const [todaySalesRes, yesterdaySalesRes, monthlySalesRes] = await Promise.all([
      prisma.sale.aggregate({
        where: { shopId, date: { gte: todayStart, lte: todayEnd }, isReversed: false },
        _sum: { total: true },
        _count: { id: true }
      }),
      prisma.sale.aggregate({
        where: { shopId, date: { gte: yesterdayStart, lte: yesterdayEnd }, isReversed: false },
        _sum: { total: true }
      }),
      prisma.sale.aggregate({
        where: { shopId, date: { gte: monthStart, lte: monthEnd }, isReversed: false },
        _sum: { total: true }
      })
    ]);

    const todaySales = todaySalesRes._sum.total?.toNumber() || 0;
    const todayBills = todaySalesRes._count.id || 0;
    const yesterdaySales = yesterdaySalesRes._sum.total?.toNumber() || 0;
    const monthlySales = monthlySalesRes._sum.total?.toNumber() || 0;

    // 2. Profit Aggregates
    const [todayProfitRes, monthlyProfitRes] = await Promise.all([
      ProfitService.calculateProfit(shopId, todayStart, todayEnd),
      ProfitService.calculateProfit(shopId, monthStart, monthEnd)
    ]);
    const todayProfit = todayProfitRes.netProfit;
    const monthlyProfit = monthlyProfitRes.netProfit;

    // 3. Stock Counts
    const [lowStock, outOfStock] = await Promise.all([
      prisma.product.count({
        where: {
          shopId,
          isDeleted: false,
          currentQuantity: { lte: prisma.product.fields.minStock }
        }
      }),
      prisma.product.count({
        where: {
          shopId,
          isDeleted: false,
          currentQuantity: { lte: 0 }
        }
      })
    ]);

    // 4. Outstanding Dues
    const [customerDueRes, supplierDueRes] = await Promise.all([
      prisma.customer.aggregate({
        where: { shopId, isDeleted: false, currentBalance: { gt: 0 } },
        _sum: { currentBalance: true }
      }),
      prisma.supplier.aggregate({
        where: { shopId, isDeleted: false, currentBalance: { gt: 0 } },
        _sum: { currentBalance: true }
      })
    ]);
    const customerDue = customerDueRes._sum.currentBalance?.toNumber() || 0;
    const supplierDue = supplierDueRes._sum.currentBalance?.toNumber() || 0;

    // 5. Cash in Hand
    const todayClosing = await DailyClosingRepository.getClosingForDate(shopId, todayStart, false);
    const closingMetrics = await DailyClosingRepository.calculateClosingMetrics(shopId, todayStart);
    const expectedCashVal =
      closingMetrics.suggestedOpeningCash +
      closingMetrics.salesCash +
      closingMetrics.paymentsReceivedCash -
      closingMetrics.expensesCash -
      closingMetrics.supplierPaymentsCash;
    const cashInHand = todayClosing ? todayClosing.closingCash.toNumber() : expectedCashVal;

    // 6. Top 10 Selling Products
    const saleItemsGrouped = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: { shopId, isReversed: false }
      },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10
    });

    const topSellingProducts = [];
    for (const item of saleItemsGrouped) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { nameEn: true, namePa: true, unit: true }
      });
      if (product) {
        topSellingProducts.push({
          id: item.productId,
          nameEn: product.nameEn,
          namePa: product.namePa,
          unit: product.unit,
          totalQty: item._sum.quantity?.toNumber() || 0,
          totalSales: item._sum.total?.toNumber() || 0
        });
      }
    }

    // 7. Last Backup Status
    const lastBackup = await prisma.backupHistory.findFirst({
      where: { shopId },
      orderBy: { createdAt: 'desc' }
    });

    // 8. Weekly Sales Trend
    const salesTrend = [];
    for (let i = 6; i >= 0; i--) {
      const dStart = new Date(todayStart);
      dStart.setDate(dStart.getDate() - i);
      const dEnd = new Date(todayEnd);
      dEnd.setDate(dEnd.getDate() - i);

      const trendAggregate = await prisma.sale.aggregate({
        where: { shopId, date: { gte: dStart, lte: dEnd }, isReversed: false },
        _sum: { total: true }
      });

      const dayNamePa = dStart.toLocaleDateString('pa-IN', { weekday: 'short' });
      const dayNameEn = dStart.toLocaleDateString('en-US', { weekday: 'short' });

      salesTrend.push({
        dateStr: dStart.toISOString().slice(0, 10),
        dayEn: dayNameEn,
        dayPa: dayNamePa,
        amount: trendAggregate._sum.total?.toNumber() || 0
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        todaySales,
        todayProfit,
        todayBills,
        yesterdaySales,
        monthlySales,
        monthlyProfit,
        customerDue,
        supplierDue,
        cashInHand,
        lowStock,
        outOfStock,
        lastBackupStatus: lastBackup ? `${lastBackup.status} (${lastBackup.createdAt.toLocaleDateString()})` : 'No backup found',
        topSellingProducts,
        salesTrend
      }
    });
  } catch (err: any) {
    console.error('Mobile Dashboard API Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
