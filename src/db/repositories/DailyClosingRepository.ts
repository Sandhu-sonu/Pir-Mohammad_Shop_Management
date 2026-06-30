import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

export class DailyClosingRepository {
  /**
   * Fetches the daily closing record for a specific date (excluding reversed ones by default, unless specified).
   */
  static async getClosingForDate(shopId: string, date: Date, includeReversed = false) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const where: Prisma.DailyClosingWhereInput = {
      shopId,
      date: {
        gte: start,
        lte: end,
      },
    };

    if (!includeReversed) {
      where.isReversed = false;
    }

    return prisma.dailyClosing.findFirst({
      where,
      include: {
        user: { select: { name: true } },
        staffUser: { select: { name: true } },
        ownerUser: { select: { name: true } },
        reversedByUser: { select: { name: true } },
      },
    });
  }

  /**
   * Calculates cash flow metrics for the given date.
   */
  static async calculateClosingMetrics(shopId: string, date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    // 1. Sales today (Cash & UPI)
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
      } else if (sale.paymentMethod === 'UPI' || sale.paymentMethod === 'BANK_TRANSFER' || sale.paymentMethod === 'CARD') {
        salesUpi = salesUpi.plus(sale.paidAmount);
      }
    }

    // 2. Customer recoveries today
    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        customer: { shopId },
      },
      select: {
        amount: true,
        paymentMethod: true,
      },
    });

    let paymentsReceivedCash = new Prisma.Decimal('0');
    let paymentsReceivedUpi = new Prisma.Decimal('0');

    for (const pm of payments) {
      if (pm.paymentMethod === 'CASH') {
        paymentsReceivedCash = paymentsReceivedCash.plus(pm.amount);
      } else {
        paymentsReceivedUpi = paymentsReceivedUpi.plus(pm.amount);
      }
    }

    // 3. Expenses today
    const expenses = await prisma.expense.findMany({
      where: {
        shopId,
        date: { gte: start, lte: end },
        isReversed: false,
      },
      select: {
        amount: true,
        paymentMethod: true,
      },
    });

    let expensesCash = new Prisma.Decimal('0');
    let expensesUpi = new Prisma.Decimal('0');

    for (const exp of expenses) {
      if (exp.paymentMethod === 'CASH') {
        expensesCash = expensesCash.plus(exp.amount);
      } else {
        expensesUpi = expensesUpi.plus(exp.amount);
      }
    }

    // 4. Supplier payments today
    const supplierPaymentsList = await prisma.supplierLedger.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        type: 'PAYMENT',
        supplier: { shopId },
      },
      select: {
        amount: true,
        paymentMethod: true,
      },
    });

    let supplierPaymentsCash = new Prisma.Decimal('0');
    let supplierPaymentsUpi = new Prisma.Decimal('0');

    for (const sp of supplierPaymentsList) {
      const val = sp.amount.abs();
      if (sp.paymentMethod === 'CASH') {
        supplierPaymentsCash = supplierPaymentsCash.plus(val);
      } else {
        supplierPaymentsUpi = supplierPaymentsUpi.plus(val);
      }
    }

    // 5. Suggested Opening Cash from the last active daily closing
    const lastActiveClosing = await prisma.dailyClosing.findFirst({
      where: {
        shopId,
        isReversed: false,
      },
      orderBy: {
        date: 'desc',
      },
    });
    const suggestedOpeningCash = lastActiveClosing?.closingCash || new Prisma.Decimal('0');

    return {
      suggestedOpeningCash: suggestedOpeningCash.toNumber(),
      salesCash: salesCash.toNumber(),
      salesUpi: salesUpi.toNumber(),
      paymentsReceivedCash: paymentsReceivedCash.toNumber(),
      paymentsReceivedUpi: paymentsReceivedUpi.toNumber(),
      expensesCash: expensesCash.toNumber(),
      expensesUpi: expensesUpi.toNumber(),
      supplierPaymentsCash: supplierPaymentsCash.toNumber(),
      supplierPaymentsUpi: supplierPaymentsUpi.toNumber(),
    };
  }

  /**
   * Saves daily closing (upsert or update if not reversed).
   */
  static async saveClosing(data: {
    shopId: string;
    date: Date;
    openingCash: number;
    closingCash: number;
    withdrawals?: number;
    notes?: string;
    staffSignature?: string;
    staffUserId?: string;
    ownerSignature?: string;
    ownerUserId?: string;
    userId?: string; // Closed By
  }) {
    const {
      shopId,
      date,
      openingCash,
      closingCash,
      withdrawals = 0,
      notes,
      staffSignature,
      staffUserId,
      ownerSignature,
      ownerUserId,
      userId,
    } = data;

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const metrics = await this.calculateClosingMetrics(shopId, date);

    const op = new Prisma.Decimal(openingCash.toString());
    const cl = new Prisma.Decimal(closingCash.toString());
    const wd = new Prisma.Decimal(withdrawals.toString());

    const sCash = new Prisma.Decimal(metrics.salesCash.toString());
    const sUpi = new Prisma.Decimal(metrics.salesUpi.toString());
    const eCash = new Prisma.Decimal(metrics.expensesCash.toString());
    const pCash = new Prisma.Decimal(metrics.paymentsReceivedCash.toString());
    const pUpi = new Prisma.Decimal(metrics.paymentsReceivedUpi.toString());
    const supCash = new Prisma.Decimal(metrics.supplierPaymentsCash.toString());
    const supUpi = new Prisma.Decimal(metrics.supplierPaymentsUpi.toString());

    // Expected Cash = Opening + Cash Sales + Cash Recoveries - Cash Expenses - Supplier Payments (Cash) - Withdrawals
    const expectedCash = op.plus(sCash).plus(pCash).minus(eCash).minus(supCash).minus(wd);
    const difference = cl.minus(expectedCash);

    const existing = await this.getClosingForDate(shopId, date, false);

    const payload = {
      openingCash: op,
      closingCash: cl,
      salesCash: sCash,
      salesUpi: sUpi,
      expensesCash: eCash,
      paymentsReceivedCash: pCash,
      paymentsReceivedUpi: pUpi,
      supplierPaymentsCash: supCash,
      supplierPaymentsUpi: supUpi,
      withdrawals: wd,
      difference,
      notes,
      isLocked: true,
      staffSignature: staffSignature || null,
      staffUserId: staffUserId || null,
      ownerSignature: ownerSignature || null,
      ownerUserId: ownerUserId || null,
      userId: userId || null,
    };

    if (existing) {
      return prisma.dailyClosing.update({
        where: { id: existing.id },
        data: payload,
      });
    } else {
      return prisma.dailyClosing.create({
        data: {
          ...payload,
          shopId,
          date: start,
        },
      });
    }
  }

  /**
   * Performs soft reversal of a daily closing.
   */
  static async reverseClosing(id: string, userId: string, reason: string) {
    return prisma.dailyClosing.update({
      where: { id },
      data: {
        isReversed: true,
        reversalReason: reason,
        reversedByUserId: userId,
        isLocked: false,
      },
    });
  }
}
