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
    const categoryId = searchParams.get('categoryId') || '';
    const categoryName = searchParams.get('category') || '';
    const status = searchParams.get('status') || ''; // 'low' or 'out'
    const sort = searchParams.get('sort') || 'nameEn:asc';

    // Parse sort query
    const [sortCol, sortDir] = sort.split(':');
    const orderDir = sortDir === 'desc' ? 'desc' : 'asc';
    const orderBy: any = {};
    if (['nameEn', 'namePa', 'currentQuantity', 'sellingPrice'].includes(sortCol)) {
      orderBy[sortCol] = orderDir;
    } else {
      orderBy['nameEn'] = 'asc';
    }

    // Base query conditions
    const where: any = {
      shopId: user.shopId,
      isDeleted: false,
    };

    // 1. Text Search Filter
    if (search.trim().length > 0) {
      where.OR = [
        { nameEn: { contains: search, mode: 'insensitive' } },
        { namePa: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 2. Category Filter
    if (categoryId) {
      where.categoryId = categoryId;
    } else if (categoryName) {
      where.categoryName = { contains: categoryName, mode: 'insensitive' };
    }

    // 3. Status Filter (Low Stock / Out of Stock)
    if (status === 'low') {
      where.currentQuantity = { lte: prisma.product.fields.minStock };
    } else if (status === 'out') {
      where.currentQuantity = { lte: 0 };
    }

    // Run parallel count and query
    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } }
        }
      })
    ]);

    // Format output with Decimal coercion and placeholder imageUrl
    const data = products.map((p) => ({
      id: p.id,
      sku: p.sku || '',
      barcode: p.barcode || '',
      nameEn: p.nameEn,
      namePa: p.namePa,
      category: p.category ? p.category.name : (p.categoryName || 'General'),
      purchasePrice: p.purchasePrice.toNumber(),
      sellingPrice: p.sellingPrice.toNumber(),
      currentQuantity: p.currentQuantity.toNumber(),
      unit: p.unit,
      minStock: p.minStock.toNumber(),
      supplierName: p.supplier ? p.supplier.name : null,
      imageUrl: null // Future ready image placeholder
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
    console.error('Mobile Inventory API Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
