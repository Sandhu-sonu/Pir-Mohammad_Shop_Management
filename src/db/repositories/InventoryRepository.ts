import { prisma } from '../prisma';
import { Prisma, TransactionType } from '@prisma/client';

export interface StockAdjustmentInput {
  productId: string;
  quantity: number; // positive to add stock, negative to reduce stock
  type: TransactionType;
  price: number; // unit cost price (for purchase) or selling price (for sale)
  note?: string;
  referenceId?: string;
  userId?: string;
}

export class InventoryRepository {
  static async getTransactionHistory(productId: string) {
    return prisma.inventoryTransaction.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async adjustStock(tx: Prisma.TransactionClient, data: StockAdjustmentInput) {
    const { productId, quantity, type, price, note, referenceId, userId } = data;
    const adjustQty = new Prisma.Decimal(quantity.toString());

    // 1. Fetch current product stock (pessimistic lock/atomic read)
    const product = await tx.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.isDeleted) {
      throw new Error('Product not found');
    }

    const previousQty = product.currentQuantity;
    const newQty = previousQty.plus(adjustQty);

    // Business Rule Check: Inventory quantity cannot become negative
    if (newQty.lessThan(0)) {
      throw new Error(`Insufficient stock for ${product.nameEn}. Available: ${previousQty}, Requested reduction: ${adjustQty.negated()}`);
    }

    // 2. Create the inventory transaction ledger entry
    const transaction = await tx.inventoryTransaction.create({
      data: {
        productId,
        type,
        quantity: adjustQty,
        previousQty,
        newQty,
        price: new Prisma.Decimal(price.toString()),
        referenceId,
        note,
        userId,
      },
    });

    // 3. Update the Product's current quantity
    await tx.product.update({
      where: { id: productId },
      data: {
        currentQuantity: newQty,
      },
    });

    return transaction;
  }
}
