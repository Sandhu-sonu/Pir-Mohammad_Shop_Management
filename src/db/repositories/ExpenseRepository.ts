import { prisma } from '../prisma';
import { Prisma, ExpenseCategory } from '@prisma/client';

export class ExpenseRepository {
  static async create(data: Omit<Prisma.ExpenseCreateInput, 'shop'> & { shopId: string }) {
    const { shopId, ...rest } = data;
    return prisma.expense.create({
      data: {
        ...rest,
        shop: { connect: { id: shopId } },
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
    const where: Prisma.ExpenseWhereInput = { shopId };

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
