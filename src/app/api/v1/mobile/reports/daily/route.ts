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
    const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    
    const start = new Date(dateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateStr);
    end.setHours(23, 59, 59, 999);

    const shopId = user.shopId;

    // Fetch aggregates
    const [salesRes, purchasesRes, expensesRes] = await Promise.all([
      prisma.sale.aggregate({
        where: { shopId, date: { gte: start, lte: end }, isReversed: false },
        _sum: { total: true },
        _count: { id: true }
      }),
      prisma.purchase.aggregate({
        where: { shopId, date: { gte: start, lte: end }, status: 'RECEIVED' },
        _sum: { total: true }
      }),
      prisma.expense.aggregate({
        where: { shopId, createdAt: { gte: start, lte: end } },
        _sum: { amount: true }
      })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        date: dateStr,
        salesTotal: salesRes._sum.total?.toNumber() || 0,
        salesCount: salesRes._count.id || 0,
        purchasesTotal: purchasesRes._sum.total?.toNumber() || 0,
        expensesTotal: expensesRes._sum.amount?.toNumber() || 0
      }
    });
  } catch (err: any) {
    console.error('Daily Report API Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
