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
    const saleId = searchParams.get('id');

    // --- CASE A: SINGLE INVOICE DETAIL VIEW ---
    if (saleId) {
      const sale = await prisma.sale.findFirst({
        where: {
          id: saleId,
          shopId: user.shopId
        },
        include: {
          customer: { select: { name: true, mobile: true } },
          createdByUser: { select: { name: true } },
          items: {
            include: {
              product: { select: { nameEn: true, namePa: true, unit: true } }
            }
          }
        }
      });

      if (!sale) {
        return NextResponse.json({ success: false, error: 'Sale record not found' }, { status: 404 });
      }

      const details = {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        date: sale.date,
        subTotal: sale.subTotal.toNumber(),
        discount: sale.discount.toNumber(),
        billDiscount: sale.billDiscount.toNumber(),
        billDiscountType: sale.billDiscountType,
        total: sale.total.toNumber(),
        paymentMethod: sale.paymentMethod,
        paidAmount: sale.paidAmount.toNumber(),
        dueAmount: sale.dueAmount.toNumber(),
        status: sale.status,
        isReversed: sale.isReversed,
        customer: sale.customer ? { name: sale.customer.name, mobile: sale.customer.mobile || '' } : null,
        cashier: sale.createdByUser ? sale.createdByUser.name : 'System',
        items: sale.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          nameEn: item.product.nameEn,
          namePa: item.product.namePa,
          unit: item.product.unit,
          quantity: item.quantity.toNumber(),
          purchasePrice: item.purchasePrice.toNumber(),
          sellingPrice: item.sellingPrice.toNumber(),
          originalPrice: item.originalPrice.toNumber(),
          itemDiscount: item.itemDiscount.toNumber(),
          discountType: item.discountType,
          total: item.total.toNumber()
        }))
      };

      return NextResponse.json({ success: true, data: details });
    }

    // --- CASE B: PAGINATED INVOICES LIST VIEW ---
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.max(1, Math.min(250, parseInt(searchParams.get('pageSize') || '50')));
    const search = searchParams.get('search') || '';
    const startDateStr = searchParams.get('startDate') || '';
    const endDateStr = searchParams.get('endDate') || '';
    const sort = searchParams.get('sort') || 'date:desc';

    const [sortCol, sortDir] = sort.split(':');
    const orderDir = sortDir === 'asc' ? 'asc' : 'desc';
    const orderBy: any = {};
    if (['date', 'total', 'invoiceNumber'].includes(sortCol)) {
      orderBy[sortCol] = orderDir;
    } else {
      orderBy['date'] = 'desc';
    }

    const where: any = {
      shopId: user.shopId,
      isReversed: false
    };

    // 1. Text Search Filter (on Invoice Number or Customer Mobile)
    if (search.trim().length > 0) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { mobile: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // 2. Date Range Filter
    if (startDateStr || endDateStr) {
      where.date = {};
      if (startDateStr) {
        where.date.gte = new Date(startDateStr);
      }
      if (endDateStr) {
        const end = new Date(endDateStr);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    // Run parallel count and query
    const [total, sales] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: { select: { name: true } },
          createdByUser: { select: { name: true } }
        }
      })
    ]);

    const data = sales.map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      date: s.date,
      total: s.total.toNumber(),
      paidAmount: s.paidAmount.toNumber(),
      dueAmount: s.dueAmount.toNumber(),
      paymentMethod: s.paymentMethod,
      customerName: s.customer ? s.customer.name : 'Walk-in',
      cashierName: s.createdByUser ? s.createdByUser.name : 'System'
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
    console.error('Mobile Sales API Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
