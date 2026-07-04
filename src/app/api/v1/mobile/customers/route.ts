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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.max(1, Math.min(250, parseInt(searchParams.get('pageSize') || '50')));
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || ''; // 'outstanding'
    const sort = searchParams.get('sort') || 'name:asc';

    // Parse sort parameter
    const [sortCol, sortDir] = sort.split(':');
    const orderDir = sortDir === 'desc' ? 'desc' : 'asc';
    const orderBy: any = {};
    if (['name', 'currentBalance', 'createdAt'].includes(sortCol)) {
      orderBy[sortCol] = orderDir;
    } else {
      orderBy['name'] = 'asc';
    }

    const where: any = {
      shopId: user.shopId,
      isDeleted: false,
    };

    // 1. Text Search Filter
    if (search.trim().length > 0) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 2. Balance status filter
    if (status === 'outstanding') {
      where.currentBalance = { gt: 0 };
    }

    // Run parallel query
    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          sales: {
            where: { isReversed: false },
            orderBy: { date: 'desc' },
            take: 1,
            select: { date: true }
          }
        }
      })
    ]);

    const data = customers.map((c) => ({
      id: c.id,
      name: c.name,
      mobile: c.mobile || '',
      address: c.address || '',
      notes: c.notes || '',
      currentBalance: c.currentBalance.toNumber(),
      createdAt: c.createdAt,
      lastVisit: c.sales.length > 0 ? c.sales[0].date : null
    }));

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (err: any) {
    console.error('Mobile Customers API Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
