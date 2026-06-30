import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

export class ProfitService {
  /**
   * Dynamically calculates business performance stats for a shop within a date range.
   * Excludes reversed sales and reversed expenses from all math.
   */
  static async calculateProfit(shopId: string, startDate: Date, endDate: Date) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 1. Fetch non-reversed sales along with sale items
    const sales = await prisma.sale.findMany({
      where: {
        shopId,
        date: { gte: start, lte: end },
        isReversed: false,
      },
      include: {
        items: true,
      },
    });

    let revenue = new Prisma.Decimal('0');
    let cogs = new Prisma.Decimal('0');

    for (const sale of sales) {
      revenue = revenue.plus(sale.total);
      for (const item of sale.items) {
        cogs = cogs.plus(item.quantity.times(item.purchasePrice));
      }
    }

    // 2. Fetch non-reversed expenses
    const expenses = await prisma.expense.findMany({
      where: {
        shopId,
        date: { gte: start, lte: end },
        isReversed: false,
      },
    });

    let totalExpenses = new Prisma.Decimal('0');
    for (const exp of expenses) {
      totalExpenses = totalExpenses.plus(exp.amount);
    }

    const grossProfit = revenue.minus(cogs);
    const netProfit = grossProfit.minus(totalExpenses);

    let profitPercentage = 0;
    if (revenue.gt(0)) {
      profitPercentage = netProfit.div(revenue).times(100).toNumber();
    }

    return {
      revenue: revenue.toNumber(),
      cogs: cogs.toNumber(),
      grossProfit: grossProfit.toNumber(),
      expenses: totalExpenses.toNumber(),
      netProfit: netProfit.toNumber(),
      profitPercentage: parseFloat(profitPercentage.toFixed(2)),
    };
  }
}
