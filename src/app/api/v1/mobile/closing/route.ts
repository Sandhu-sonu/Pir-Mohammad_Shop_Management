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
    const sort = searchParams.get('sort') || 'date:desc';

    const [sortCol, sortDir] = sort.split(':');
    const orderDir = sortDir === 'asc' ? 'asc' : 'desc';
    const orderBy: any = {};
    if (['date', 'closingCash', 'difference'].includes(sortCol)) {
      orderBy[sortCol] = orderDir;
    } else {
      orderBy['date'] = 'desc';
    }

    const where = {
      shopId: user.shopId
    };

    // Run parallel count and query
    const [total, closings] = await Promise.all([
      prisma.dailyClosing.count({ where }),
      prisma.dailyClosing.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { name: true } }
        }
      })
    ]);

    const data = closings.map((dc) => ({
      id: dc.id,
      date: dc.date,
      openingCash: dc.openingCash.toNumber(),
      salesCash: dc.salesCash.toNumber(),
      salesUpi: dc.salesUpi.toNumber(),
      expensesCash: dc.expensesCash.toNumber(),
      paymentsReceivedCash: dc.paymentsReceivedCash.toNumber(),
      paymentsReceivedUpi: dc.paymentsReceivedUpi.toNumber(),
      supplierPaymentsCash: dc.supplierPaymentsCash.toNumber(),
      supplierPaymentsUpi: dc.supplierPaymentsUpi.toNumber(),
      closingCash: dc.closingCash.toNumber(),
      difference: dc.difference.toNumber(),
      withdrawals: dc.withdrawals.toNumber(),
      notes: dc.notes || '',
      closedBy: dc.user ? dc.user.name : 'System'
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
    console.error('Mobile Closing API Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
