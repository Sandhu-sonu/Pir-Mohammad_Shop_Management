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

    const shopId = user.shopId;
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const notifications: any[] = [];

    // 1. Low Stock Notifications
    const lowStockProducts = await prisma.product.findMany({
      where: {
        shopId,
        isDeleted: false,
        currentQuantity: { lte: prisma.product.fields.minStock }
      },
      select: { id: true, nameEn: true, namePa: true, currentQuantity: true, minStock: true, unit: true },
      take: 10
    });
    for (const p of lowStockProducts) {
      notifications.push({
        id: `low-stock-${p.id}`,
        type: 'LOW_STOCK',
        title: 'ਸਟਾਕ ਘੱਟ ਹੈ (Low Stock Alert)',
        message: `Product "${p.nameEn} / ${p.namePa}" is running low. Only ${p.currentQuantity.toNumber()} ${p.unit} remaining (Min: ${p.minStock.toNumber()}).`,
        timestamp: now,
        severity: 'HIGH'
      });
    }

    // 2. Large Discount Notifications (Discounts > Rs 200 in the last 7 days)
    const largeDiscountSales = await prisma.sale.findMany({
      where: {
        shopId,
        date: { gte: sevenDaysAgo },
        isReversed: false,
        OR: [
          { discount: { gt: 200 } },
          { billDiscount: { gt: 200 } }
        ]
      },
      select: { id: true, invoiceNumber: true, total: true, discount: true, billDiscount: true, date: true },
      orderBy: { date: 'desc' },
      take: 5
    });
    for (const s of largeDiscountSales) {
      const discVal = s.discount.toNumber() + s.billDiscount.toNumber();
      notifications.push({
        id: `large-disc-${s.id}`,
        type: 'LARGE_DISCOUNT',
        title: 'ਵੱਡੀ ਛੋਟ ਦਿੱਤੀ ਗਈ (Large Discount Sales)',
        message: `Invoice ${s.invoiceNumber} checkout complete with a total discount of ₹${discVal} (Total Bill: ₹${s.total.toNumber()}).`,
        timestamp: s.date,
        severity: 'MEDIUM'
      });
    }

    // 3. Large Expense Notifications (Expenses > Rs 2000 in the last 7 days)
    const largeExpenses = await prisma.expense.findMany({
      where: {
        shopId,
        createdAt: { gte: sevenDaysAgo },
        amount: { gt: 2000 }
      },
      select: { id: true, category: true, amount: true, description: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    for (const e of largeExpenses) {
      notifications.push({
        id: `large-exp-${e.id}`,
        type: 'LARGE_EXPENSE',
        title: 'ਵੱਡਾ ਖਰਚਾ (Large Expense Logged)',
        message: `An expense of ₹${e.amount.toNumber()} was logged under category "${e.category}" (${e.description || 'No description'}).`,
        timestamp: e.createdAt,
        severity: 'MEDIUM'
      });
    }

    // 4. Backup Failure Notifications (Last 7 days)
    const failedBackups = await prisma.backupHistory.findMany({
      where: {
        shopId,
        createdAt: { gte: sevenDaysAgo },
        status: 'FAILED'
      },
      select: { id: true, filename: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    for (const b of failedBackups) {
      notifications.push({
        id: `backup-fail-${b.id}`,
        type: 'BACKUP_FAILED',
        title: 'ਬੈਕਅੱਪ ਅਸਫਲ (Backup Operation Failed)',
        message: `Automatic/Manual database backup failed on ${b.createdAt.toLocaleDateString()}. Please check storage space.`,
        timestamp: b.createdAt,
        severity: 'HIGH'
      });
    }

    // 5. Daily Closings Completed (Last 7 days)
    const recentClosings = await prisma.dailyClosing.findMany({
      where: {
        shopId,
        date: { gte: sevenDaysAgo }
      },
      select: { id: true, date: true, closingCash: true, difference: true },
      orderBy: { date: 'desc' },
      take: 5
    });
    for (const c of recentClosings) {
      const diffVal = c.difference.toNumber();
      notifications.push({
        id: `closing-done-${c.id}`,
        type: 'DAILY_CLOSING',
        title: 'ਰੋਜ਼ਾਨਾ ਕਲੋਜ਼ਿੰਗ ਮੁਕੰਮਲ (Daily Closing Completed)',
        message: `Daily Closing completed for date ${c.date.toISOString().slice(0, 10)}. Closing Cash: ₹${c.closingCash.toNumber()} (Diff: ₹${diffVal}).`,
        timestamp: c.date,
        severity: 'INFO'
      });
    }

    // Sort by timestamp desc
    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      success: true,
      data: notifications
    });
  } catch (err: any) {
    console.error('Mobile Notifications API Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
