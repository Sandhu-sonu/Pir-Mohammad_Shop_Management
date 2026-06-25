import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

export class DailyClosingRepository {
  static async getClosingForDate(shopId: string, date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return prisma.dailyClosing.findFirst({
      where: {
        shopId,
        date: {
          gte: start,
          lte: end,
        },
      },
    });
  }

  static async calculateClosingMetrics(shopId: string, date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    // 1. Sum of cash/UPI sales today
    const sales = await prisma.sale.findMany({
      where: {
        shopId,
        date: { gte: start, lte: end },
        isReversed: false,
      },
      select: {
        paidAmount: true,
        paymentMethod: true,
      },
    });

    let salesCash = new Prisma.Decimal('0');
    let salesUpi = new Prisma.Decimal('0');

    for (const sale of sales) {
      if (sale.paymentMethod === 'CASH') {
        salesCash = salesCash.plus(sale.paidAmount);
      } else if (sale.paymentMethod === 'UPI') {
        salesUpi = salesUpi.plus(sale.paidAmount);
      }
    }

    // 2. Sum of cash/UPI payments received today (from customer Khata payments)
    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        customer: { shopId },
      },
      select: {
        amount: true,
        sale: {
          select: {
            paymentMethod: true,
          },
        },
      },
    });

    let paymentsReceivedCash = new Prisma.Decimal('0');
    let paymentsReceivedUpi = new Prisma.Decimal('0');

    for (const pm of payments) {
      // By default if not linked to a sale, we assume CASH
      const method = pm.sale?.paymentMethod || 'CASH';
      if (method === 'CASH') {
        paymentsReceivedCash = paymentsReceivedCash.plus(pm.amount);
      } else {
        paymentsReceivedUpi = paymentsReceivedUpi.plus(pm.amount);
      }
    }

    // 3. Sum of expenses paid in cash today
    const expenses = await prisma.expense.aggregate({
      where: {
        shopId,
        date: { gte: start, lte: end },
      },
      _sum: {
        amount: true,
      },
    });

    const expensesCash = expenses._sum.amount || new Prisma.Decimal('0');

    // 4. Try to fetch the latest closing balance of yesterday to suggest opening cash
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayClosing = await this.getClosingForDate(shopId, yesterday);
    const suggestedOpeningCash = yesterdayClosing?.closingCash || new Prisma.Decimal('0');

    return {
      suggestedOpeningCash: suggestedOpeningCash.toNumber(),
      salesCash: salesCash.toNumber(),
      salesUpi: salesUpi.toNumber(),
      paymentsReceivedCash: paymentsReceivedCash.toNumber(),
      paymentsReceivedUpi: paymentsReceivedUpi.toNumber(),
      expensesCash: expensesCash.toNumber(),
    };
  }

  static async saveClosing(data: {
    shopId: string;
    date: Date;
    openingCash: number;
    closingCash: number;
    notes?: string;
  }) {
    const { shopId, date, openingCash, closingCash, notes } = data;
    
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const metrics = await this.calculateClosingMetrics(shopId, date);

    const op = new Prisma.Decimal(openingCash.toString());
    const cl = new Prisma.Decimal(closingCash.toString());
    
    const sCash = new Prisma.Decimal(metrics.salesCash.toString());
    const sUpi = new Prisma.Decimal(metrics.salesUpi.toString());
    const eCash = new Prisma.Decimal(metrics.expensesCash.toString());
    const pCash = new Prisma.Decimal(metrics.paymentsReceivedCash.toString());
    const pUpi = new Prisma.Decimal(metrics.paymentsReceivedUpi.toString());

    // Expected Cash in hand = Opening Cash + Cash Sales + Cash Payments Received - Cash Expenses
    const expectedCash = op.plus(sCash).plus(pCash).minus(eCash);
    const difference = cl.minus(expectedCash);

    // Upsert daily closing
    const existing = await this.getClosingForDate(shopId, date);

    if (existing) {
      return prisma.dailyClosing.update({
        where: { id: existing.id },
        data: {
          openingCash: op,
          closingCash: cl,
          salesCash: sCash,
          salesUpi: sUpi,
          expensesCash: eCash,
          paymentsReceivedCash: pCash,
          paymentsReceivedUpi: pUpi,
          difference,
          notes,
        },
      });
    } else {
      return prisma.dailyClosing.create({
        data: {
          shopId,
          date: start,
          openingCash: op,
          closingCash: cl,
          salesCash: sCash,
          salesUpi: sUpi,
          expensesCash: eCash,
          paymentsReceivedCash: pCash,
          paymentsReceivedUpi: pUpi,
          difference,
          notes,
        },
      });
    }
  }
}
