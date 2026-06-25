import { prisma } from '../prisma';
import { Prisma, CustomerLedgerType } from '@prisma/client';

export interface CustomerFilterInput {
  search?: string;
  shopId: string;
  page?: number;
  limit?: number;
}

export class CustomerRepository {
  static async findById(id: string) {
    return prisma.customer.findUnique({
      where: { id, isDeleted: false },
    });
  }

  static async findAll(filters: CustomerFilterInput) {
    const { search, shopId, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      shopId,
      isDeleted: false,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      items,
      total,
      pages: Math.ceil(total / limit),
      page,
      limit,
    };
  }

  static async create(data: Omit<Prisma.CustomerCreateInput, 'shop'> & { shopId: string }) {
    const { shopId, openingBalance = 0, ...rest } = data;
    const initialBalance = new Prisma.Decimal(openingBalance.toString());

    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          ...rest,
          openingBalance: initialBalance,
          currentBalance: initialBalance,
          shop: { connect: { id: shopId } },
        },
      });

      if (initialBalance.greaterThan(0)) {
        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            type: CustomerLedgerType.OPENING,
            amount: initialBalance,
            balanceAfter: initialBalance,
            note: 'Opening Udhaar/Credit Balance',
          },
        });
      }

      return customer;
    });
  }

  static async update(id: string, data: Prisma.CustomerUpdateInput) {
    return prisma.customer.update({
      where: { id },
      data,
    });
  }

  static async softDelete(id: string) {
    return prisma.customer.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  static async getLedger(customerId: string) {
    return prisma.customerLedger.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: { sale: true },
    });
  }

  static async receivePayment(shopId: string, customerId: string, amount: number, note?: string) {
    const paymentAmount = new Prisma.Decimal(amount.toString());

    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer || customer.isDeleted) {
        throw new Error('Customer not found');
      }

      const newBalance = customer.currentBalance.minus(paymentAmount);

      const payment = await tx.payment.create({
        data: {
          customerId,
          amount: paymentAmount,
          note,
        },
      });

      await tx.customer.update({
        where: { id: customerId },
        data: { currentBalance: newBalance },
      });

      const ledger = await tx.customerLedger.create({
        data: {
          customerId,
          type: CustomerLedgerType.PAYMENT,
          amount: paymentAmount.negated(), // payment reduces what they owe
          balanceAfter: newBalance,
          referenceId: payment.id,
          note: note || 'Payment Received',
        },
      });

      return { payment, ledger };
    });
  }
}
