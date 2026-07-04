import { NextResponse } from 'next/server';
import { prisma } from '@/db/prisma';
import { getCurrentUser } from '@/lib/actions/auth';
import { Role } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== Role.OWNER) {
      return NextResponse.json({ success: false, error: 'Forbidden: Owner access only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const now = new Date();
    const start = startDateStr ? new Date(startDateStr) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDateStr ? new Date(endDateStr) : new Date(now);
    end.setHours(23, 59, 59, 999);

    const shopId = user.shopId;

    const salesGrouped = await prisma.sale.groupBy({
      by: ['customerId'],
      where: {
        shopId,
        date: { gte: start, lte: end },
        isReversed: false,
        customerId: { not: null }
      },
      _sum: { total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10
    });

    const topCustomers = [];
    for (const item of salesGrouped) {
      if (item.customerId) {
        const customer = await prisma.customer.findUnique({
          where: { id: item.customerId },
          select: { name: true, mobile: true }
        });
        if (customer) {
          topCustomers.push({
            id: item.customerId,
            name: customer.name,
            mobile: customer.mobile || '',
            totalSpent: item._sum.total?.toNumber() || 0
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: topCustomers
    });
  } catch (err: any) {
    console.error('Top Customers Report API Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
