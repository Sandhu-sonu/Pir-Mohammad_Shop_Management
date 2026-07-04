import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/actions/auth';
import { ProfitService } from '@/db/services/ProfitService';
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

    // Default to current month
    const now = new Date();
    const start = startDateStr ? new Date(startDateStr) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDateStr ? new Date(endDateStr) : new Date(now);
    end.setHours(23, 59, 59, 999);

    const profitStats = await ProfitService.calculateProfit(user.shopId, start, end);

    return NextResponse.json({
      success: true,
      data: {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        grossProfit: profitStats.grossProfit,
        netProfit: profitStats.netProfit,
        revenue: profitStats.revenue,
        cogs: profitStats.cogs,
        expenses: profitStats.expenses,
        profitPercentage: profitStats.profitPercentage
      }
    });
  } catch (err: any) {
    console.error('Profit Report API Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
