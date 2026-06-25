import { CustomerRepository, CustomerFilterInput } from '../repositories/CustomerRepository';
import { prisma } from '../prisma';

export class CustomerService {
  static async getCustomer(id: string) {
    return CustomerRepository.findById(id);
  }

  static async listCustomers(filters: CustomerFilterInput) {
    return CustomerRepository.findAll(filters);
  }

  static async addCustomer(data: {
    shopId: string;
    name: string;
    mobile?: string;
    address?: string;
    notes?: string;
    openingBalance?: number;
  }) {
    return CustomerRepository.create({
      shopId: data.shopId,
      name: data.name,
      mobile: data.mobile || null,
      address: data.address || null,
      notes: data.notes || null,
      openingBalance: data.openingBalance || 0,
    });
  }

  static async updateCustomer(
    id: string,
    data: Partial<{
      name: string;
      mobile: string;
      address: string;
      notes: string;
    }>
  ) {
    return CustomerRepository.update(id, data);
  }

  static async deleteCustomer(id: string) {
    return CustomerRepository.softDelete(id);
  }

  static async getCustomerLedger(customerId: string) {
    return CustomerRepository.getLedger(customerId);
  }

  static async receivePayment(shopId: string, customerId: string, amount: number, note?: string) {
    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }
    return CustomerRepository.receivePayment(shopId, customerId, amount, note);
  }

  static async getCustomerProfile(customerId: string) {
    const customer = await CustomerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    // Get total purchases
    const salesAggregate = await prisma.sale.aggregate({
      where: {
        customerId,
        isReversed: false,
      },
      _sum: {
        total: true,
      },
    });

    // Get last purchase
    const lastSale = await prisma.sale.findFirst({
      where: {
        customerId,
        isReversed: false,
      },
      orderBy: {
        date: 'desc',
      },
      select: {
        date: true,
        total: true,
        invoiceNumber: true,
      },
    });

    // Get payment history
    const payments = await prisma.payment.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      customer,
      totalPurchases: salesAggregate._sum.total?.toNumber() || 0,
      pendingAmount: customer.currentBalance.toNumber(),
      lastPurchase: lastSale
        ? {
            date: lastSale.date,
            total: lastSale.total.toNumber(),
            invoiceNumber: lastSale.invoiceNumber,
          }
        : null,
      recentPayments: payments.map((p) => ({
        id: p.id,
        amount: p.amount.toNumber(),
        note: p.note,
        date: p.createdAt,
      })),
    };
  }
}
