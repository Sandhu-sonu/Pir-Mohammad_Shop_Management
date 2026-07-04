import { NextResponse } from 'next/server';
import { prisma } from '@/db/prisma';
import { getCurrentUser } from '@/lib/actions/auth';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { shopId, address, gst } = await request.json();

    if (shopId !== user.shopId) {
      return NextResponse.json({ success: false, error: 'Forbidden: Cannot update other shops' }, { status: 403 });
    }

    await prisma.shop.update({
      where: { id: shopId },
      data: {
        address: address || '',
        gst: gst || ''
      }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('API Shop Update Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
