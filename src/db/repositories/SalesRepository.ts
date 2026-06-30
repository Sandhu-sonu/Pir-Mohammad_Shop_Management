import { prisma } from '../prisma';
import { Prisma, PaymentMethod, TransactionType, CustomerLedgerType } from '@prisma/client';
import { InventoryRepository } from './InventoryRepository';

export interface SaleItemInput {
  productId: string;
  quantity: number;
  sellingPrice: number;
}

export interface CreateSaleInput {
  shopId: string;
  customerId?: string;
  items: SaleItemInput[];
  discount: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  userId?: string;
}

export class SalesRepository {
  static async findById(id: string) {
    return prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
        },
        customer: true,
      },
    });
  }

  static async findByInvoiceNumber(invoiceNumber: string) {
    return prisma.sale.findUnique({
      where: { invoiceNumber },
      include: {
        items: {
          include: { product: true },
        },
        customer: true,
      },
    });
  }

  static async findAll(shopId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.sale.findMany({
        where: { shopId },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        include: { customer: true },
      }),
      prisma.sale.count({ where: { shopId } }),
    ]);

    return {
      items,
      total,
      pages: Math.ceil(total / limit),
      page,
      limit,
    };
  }

  static async generateInvoiceNumber(shopId: string): Promise<string> {
    const settings = await prisma.settings.findUnique({
      where: { shopId },
    });
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
    });
    const isGst = shop?.gstRegistered && settings?.receiptFormat === 'DETAILED';
    const prefixStr = isGst ? (settings?.taxPrefix || 'INV-') : (settings?.receiptPrefix || 'RCP-');
    
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `${prefixStr}${todayStr}-`;
    
    // Find the latest invoice number with today's prefix
    const latestSale = await prisma.sale.findFirst({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
    });

    let seq = 1;
    if (latestSale && latestSale.invoiceNumber) {
      const parts = latestSale.invoiceNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${seq.toString().padStart(4, '0')}`;
  }

  static async create(data: CreateSaleInput) {
    const { shopId, customerId, items, discount, paymentMethod, paidAmount, userId } = data;

    return prisma.$transaction(async (tx) => {
      // 1. Validate items and compute totals (batch query optimized)
      let subTotal = new Prisma.Decimal('0');
      const resolvedItems = [];

      const productIds = items.map(item => item.productId);
      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          isDeleted: false,
        },
      });

      const productMap = new Map(products.map(p => [p.id, p]));

      for (const item of items) {
        const product = productMap.get(item.productId);

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        const qty = new Prisma.Decimal(item.quantity.toString());
        const sellPrice = new Prisma.Decimal(item.sellingPrice.toString());
        const total = qty.times(sellPrice);
        subTotal = subTotal.plus(total);

        resolvedItems.push({
          productId: product.id,
          quantity: qty,
          purchasePrice: product.purchasePrice,
          sellingPrice: sellPrice,
          total,
        });
      }

      const discAmount = new Prisma.Decimal(discount.toString());
      const totalAmount = subTotal.minus(discAmount);
      const paid = new Prisma.Decimal(paidAmount.toString());
      const due = totalAmount.minus(paid);

      if (paymentMethod === PaymentMethod.CREDIT && !customerId) {
        throw new Error('Customer is required for credit/Udhaar sales.');
      }

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(shopId);

      // 2. Create Sale record
      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          shopId,
          customerId,
          subTotal,
          discount: discAmount,
          total: totalAmount,
          paymentMethod,
          paidAmount: paid,
          dueAmount: due,
        },
      });

      // 3. Create Sale Items & Adjust Stock
      for (const rItem of resolvedItems) {
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: rItem.productId,
            quantity: rItem.quantity,
            purchasePrice: rItem.purchasePrice,
            sellingPrice: rItem.sellingPrice,
            total: rItem.total,
          },
        });

        // Reduce stock atomically (negative quantity)
        await InventoryRepository.adjustStock(tx, {
          productId: rItem.productId,
          quantity: -rItem.quantity.toNumber(),
          type: TransactionType.SALE,
          price: rItem.sellingPrice.toNumber(),
          referenceId: sale.id,
          note: `Sale Invoice: ${invoiceNumber}`,
          userId,
        });
      }

      // 4. Update Customer Udhaar / Khata if applicable
      if (customerId) {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
        });

        if (!customer) throw new Error('Customer not found');

        const newBalance = customer.currentBalance.plus(due);

        await tx.customer.update({
          where: { id: customerId },
          data: {
            currentBalance: newBalance,
          },
        });

        // Add to customer ledger if there's any ledger movement (due > 0 or paid > 0)
        // A sale creates a customer ledger transaction of type SALE with the entire total
        // and if there was a payment, it registers it.
        await tx.customerLedger.create({
          data: {
            customerId,
            type: CustomerLedgerType.SALE,
            amount: totalAmount, // The customer owes this total amount
            balanceAfter: customer.currentBalance.plus(totalAmount),
            referenceId: sale.id,
            saleId: sale.id,
            note: `Bill Total: ${invoiceNumber}`,
          },
        });

        if (paid.greaterThan(0)) {
          // If they paid some amount, log the payment reduction
          await tx.payment.create({
            data: {
              customerId,
              saleId: sale.id,
              amount: paid,
              note: `Paid against bill ${invoiceNumber}`,
            },
          });

          await tx.customerLedger.create({
            data: {
              customerId,
              type: CustomerLedgerType.PAYMENT,
              amount: paid.negated(), // payment reduces what they owe
              balanceAfter: newBalance,
              referenceId: sale.id,
              saleId: sale.id,
              note: `Cash Paid for ${invoiceNumber}`,
            },
          });
        }
      }

      // Return populated sale
      const fullSale = await tx.sale.findUnique({
        where: { id: sale.id },
        include: {
          items: {
            include: { product: true },
          },
          customer: true,
        },
      });
      return fullSale!;
    });
  }

  static async reverse(saleId: string, userId?: string) {
    return prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: true },
      });

      if (!sale) throw new Error('Sale not found');
      if (sale.isReversed) throw new Error('Sale is already reversed');

      // 1. Mark sale as reversed
      await tx.sale.update({
        where: { id: saleId },
        data: { isReversed: true },
      });

      // 2. Return items to stock
      for (const item of sale.items) {
        await InventoryRepository.adjustStock(tx, {
          productId: item.productId,
          quantity: item.quantity.toNumber(), // add back to inventory
          type: TransactionType.RETURN,
          price: item.sellingPrice.toNumber(),
          referenceId: sale.id,
          note: `Reversal of Invoice: ${sale.invoiceNumber}`,
          userId,
        });
      }

      // 3. Update customer Khata if they were linked
      if (sale.customerId) {
        const customer = await tx.customer.findUnique({
          where: { id: sale.customerId },
        });

        if (!customer) throw new Error('Customer not found');

        // Subtract the net balance change that the sale added
        // The sale added (dueAmount) to currentBalance. Reversing it subtracts dueAmount.
        const newBalance = customer.currentBalance.minus(sale.dueAmount);

        await tx.customer.update({
          where: { id: sale.customerId },
          data: {
            currentBalance: newBalance,
          },
        });

        await tx.customerLedger.create({
          data: {
            customerId: sale.customerId,
            type: CustomerLedgerType.ADJUSTMENT,
            amount: sale.dueAmount.negated(),
            balanceAfter: newBalance,
            referenceId: sale.id,
            saleId: sale.id,
            note: `Reversal / Return of Invoice: ${sale.invoiceNumber}`,
          },
        });
      }

      return sale;
    });
  }
}
