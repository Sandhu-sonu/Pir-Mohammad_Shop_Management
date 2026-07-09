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

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(todayEnd);

    // 1. Sales Aggregates
    const [todaySalesRes, monthlySalesRes] = await Promise.all([
      prisma.sale.aggregate({
        where: { shopId, date: { gte: todayStart, lte: todayEnd }, isReversed: false },
        _sum: { total: true },
        _count: { id: true }
      }),
      prisma.sale.aggregate({
        where: { shopId, date: { gte: monthStart, lte: monthEnd }, isReversed: false },
        _sum: { total: true }
      })
    ]);

    const todaySales = todaySalesRes._sum.total?.toNumber() || 0;
    const todayBills = todaySalesRes._count.id || 0;
    const monthlySales = monthlySalesRes._sum.total?.toNumber() || 0;

    // 2. Today's Collections (Payments Received Today)
    const todayPayments = await prisma.payment.aggregate({
      where: {
        customer: { shopId },
        createdAt: { gte: todayStart, lte: todayEnd }
      },
      _sum: { amount: true }
    });
    const todayCollection = todayPayments._sum.amount?.toNumber() || 0;

    // 3. Stock Counts
    const [totalProducts, lowStock, outOfStock] = await Promise.all([
      prisma.product.count({
        where: { shopId, isDeleted: false }
      }),
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

    // 4. Outstanding Dues & Total Customers
    const [customerDueRes, totalCustomers] = await Promise.all([
      prisma.customer.aggregate({
        where: { shopId, isDeleted: false, currentBalance: { gt: 0 } },
        _sum: { currentBalance: true }
      }),
      prisma.customer.count({
        where: { shopId, isDeleted: false }
      })
    ]);
    const customerDue = customerDueRes._sum.currentBalance?.toNumber() || 0;

    // 5. Subscription Status
    const subscription = await prisma.subscription.findUnique({
      where: { shopId },
      include: { plan: { select: { name: true } } }
    });

    const subscriptionStatus = subscription ? subscription.status : 'TRIAL';
    const subscriptionExpiry = subscription ? subscription.endDate.toISOString() : null;
    const planName = subscription?.plan?.name || 'Trial Plan';

    return NextResponse.json({
      success: true,
      data: {
        todaySales,
        todayCollection,
        todayBills,
        monthlySales,
        customerDue,
        totalProducts,
        totalCustomers,
        lowStock,
        outOfStock,
        subscriptionStatus,
        subscriptionExpiry,
        planName
      }
    });
  } catch (err: any) {
    console.error('Mobile Dashboard API Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
