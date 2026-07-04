import { NextResponse } from 'next/server';
import { prisma } from '@/db/prisma';
import { getCurrentUser } from '@/lib/actions/auth';
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

    const shop = await prisma.shop.findUnique({
      where: { id: user.shopId },
      include: {
        settings: true
      }
    });

    if (!shop) {
      return NextResponse.json({ success: false, error: 'Shop config not found' }, { status: 404 });
    }

    // Get database sizing stats
    const [productsCount, salesCount, customersCount] = await Promise.all([
      prisma.product.count({ where: { shopId: shop.id, isDeleted: false } }),
      prisma.sale.count({ where: { shopId: shop.id } }),
      prisma.customer.count({ where: { shopId: shop.id, isDeleted: false } })
    ]);

    const data = {
      shopId: shop.id,
      name: shop.name,
      address: shop.address || '',
      gst: shop.gst || '',
      phone: shop.phone || '',
      email: shop.email || '',
      businessType: shop.businessType,
      logoUrl: null, // Placeholder for future shop logo support
      settings: {
        language: shop.settings?.language || 'pa',
        theme: shop.settings?.theme || 'light',
        lowStockAlert: shop.settings?.lowStockAlert ?? true,
        printerType: shop.settings?.printerType || 'THERMAL_80',
        autoSuggestEnglish: shop.settings?.autoSuggestEnglish ?? true,
        autoSuggestPunjabi: shop.settings?.autoSuggestPunjabi ?? true
      },
      stats: {
        productsCount,
        salesCount,
        customersCount
      }
    };

    return NextResponse.json({
      success: true,
      data
    });
  } catch (err: any) {
    console.error('Mobile Settings API Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
