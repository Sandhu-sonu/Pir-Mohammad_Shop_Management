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

    const saleItemsGrouped = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          shopId,
          date: { gte: start, lte: end },
          isReversed: false
        }
      },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10
    });

    const topProducts = [];
    for (const item of saleItemsGrouped) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { nameEn: true, namePa: true, unit: true }
      });
      if (product) {
        topProducts.push({
          id: item.productId,
          nameEn: product.nameEn,
          namePa: product.namePa,
          unit: product.unit,
          totalQty: item._sum.quantity?.toNumber() || 0,
          totalSales: item._sum.total?.toNumber() || 0
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: topProducts
    });
  } catch (err: any) {
    console.error('Top Products Report API Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
