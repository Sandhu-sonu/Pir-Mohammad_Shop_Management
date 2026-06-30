import { prisma } from '../prisma';
import { Prisma, PaymentMethod } from '@prisma/client';

export class ExpenseRepository {
  static async findById(id: string) {
    return prisma.expense.findUnique({
      where: { id },
      include: {
        user: true,
        reversedByUser: true,
      },
    });
  }

  static async create(data: any) {
    const { shopId, ...rest } = data;
    return prisma.expense.create({
      data: {
        ...rest,
        amount: new Prisma.Decimal(rest.amount.toString()),
        shopId,
      } as any,
    });
  }

  static async update(
    id: string,
    data: Partial<{
      category: string;
      amount: number;
      description: string;
      paymentMethod: PaymentMethod;
      notes: string;
      date: Date;
    }>
  ) {
    const updateData: Prisma.ExpenseUpdateInput = {};

    if (data.category !== undefined) updateData.category = data.category;
    if (data.amount !== undefined) updateData.amount = new Prisma.Decimal(data.amount.toString());
    if (data.description !== undefined) updateData.description = data.description;
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.date !== undefined) updateData.date = data.date;

    return prisma.expense.update({
      where: { id },
      data: updateData,
    });
  }

  static async reverse(id: string, userId: string, reason: string) {
    return prisma.expense.update({
      where: { id },
      data: {
        isReversed: true,
        reversalReason: reason,
        reversedByUser: { connect: { id: userId } },
      },
    });
  }

  static async findAll(shopId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.expense.findMany({
        where: { shopId },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { name: true } },
          reversedByUser: { select: { name: true } },
        },
      }),
      prisma.expense.count({ where: { shopId } }),
    ]);

    return {
      items,
      total,
      pages: Math.ceil(total / limit),
      page,
      limit,
    };
  }

  static async getSummaryByCategory(shopId: string, startDate?: Date, endDate?: Date) {
    const where: Prisma.ExpenseWhereInput = { shopId, isReversed: false };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    const expenses = await prisma.expense.groupBy({
      by: ['category'],
      where,
      _sum: {
        amount: true,
      },
    });

    return expenses.map((e) => ({
      category: e.category,
      totalAmount: e._sum.amount?.toNumber() || 0,
    }));
  }
}
