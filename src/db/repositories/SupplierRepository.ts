import { prisma } from '../prisma';
import { Prisma, SupplierLedgerType, TransactionType, PaymentMethod } from '@prisma/client';
import { InventoryRepository } from './InventoryRepository';

export interface PurchaseItemInput {
  productId: string;
  quantity: number;
  purchasePrice: number;
}

export interface CreatePurchaseInput {
  shopId: string;
  supplierId: string;
  items: PurchaseItemInput[];
  invoiceNumber?: string;
  note?: string;
  paidAmount: number;
  paymentMethod?: PaymentMethod;
}

export class SupplierRepository {
  static async findById(id: string) {
    return prisma.supplier.findUnique({
      where: { id, isDeleted: false },
    });
  }

  static async findAll(shopId: string) {
    return prisma.supplier.findMany({
      where: { shopId, isDeleted: false },
      orderBy: { name: 'asc' },
    });
  }

  static async create(data: Omit<Prisma.SupplierCreateInput, 'shop'> & { shopId: string }) {
    const { shopId, currentBalance = 0, ...rest } = data;
    const initialBalance = new Prisma.Decimal(currentBalance.toString());

    return prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          ...rest,
          currentBalance: initialBalance,
          shop: { connect: { id: shopId } },
        },
      });

      if (initialBalance.greaterThan(0)) {
        await tx.supplierLedger.create({
          data: {
            supplierId: supplier.id,
            type: SupplierLedgerType.OPENING,
            amount: initialBalance,
            balanceAfter: initialBalance,
            note: 'Opening Outstanding Balance',
          },
        });
      }

      return supplier;
    });
  }

  static async createPurchase(data: CreatePurchaseInput) {
    const { shopId, supplierId, items, invoiceNumber, note, paidAmount } = data;

    return prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({
        where: { id: supplierId },
      });

      if (!supplier || supplier.isDeleted) {
        throw new Error('Supplier not found');
      }

      let total = new Prisma.Decimal('0');
      const resolvedItems = [];

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product || product.isDeleted) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        const qty = new Prisma.Decimal(item.quantity.toString());
        const price = new Prisma.Decimal(item.purchasePrice.toString());
        total = total.plus(qty.times(price));

        resolvedItems.push({
          productId: product.id,
          quantity: qty,
          purchasePrice: price,
        });
      }

      const paid = new Prisma.Decimal(paidAmount.toString());
      const due = total.minus(paid);

      // Create Purchase record
      const purchase = await tx.purchase.create({
        data: {
          invoiceNumber,
          supplierId,
          shopId,
          total,
          paidAmount: paid,
          dueAmount: due,
          note,
        },
      });

      // Increase stock for each product
      for (const rItem of resolvedItems) {
        await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            productId: rItem.productId,
            quantity: rItem.quantity,
            purchasePrice: rItem.purchasePrice,
          },
        });

        // Add stock atomically (positive quantity)
        await InventoryRepository.adjustStock(tx, {
          productId: rItem.productId,
          quantity: rItem.quantity.toNumber(),
          type: TransactionType.PURCHASE,
          price: rItem.purchasePrice.toNumber(),
          referenceId: purchase.id,
          note: `Purchase Invoice: ${invoiceNumber || purchase.id}`,
        });
      }

      // Update Supplier balance (due adds to what we owe them)
      const newBalance = supplier.currentBalance.plus(due);
      await tx.supplier.update({
        where: { id: supplierId },
        data: { currentBalance: newBalance },
      });

      // Log Supplier Ledger
      await tx.supplierLedger.create({
        data: {
          supplierId,
          type: SupplierLedgerType.PURCHASE,
          amount: total,
          balanceAfter: supplier.currentBalance.plus(total),
          referenceId: purchase.id,
          note: `Purchase Total: ${invoiceNumber || purchase.id}`,
        },
      });

      if (paid.greaterThan(0)) {
        await tx.supplierLedger.create({
          data: {
            supplierId,
            type: SupplierLedgerType.PAYMENT,
            amount: paid.negated(),
            balanceAfter: newBalance,
            paymentMethod: data.paymentMethod || 'CASH',
            referenceId: purchase.id,
            note: `Payment Paid for Purchase: ${invoiceNumber || purchase.id}`,
          },
        });
      }

      return purchase;
    });
  }

  static async paySupplier(shopId: string, supplierId: string, amount: number, note?: string, paymentMethod: PaymentMethod = 'CASH') {
    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    return prisma.$transaction(async (tx: any) => {
      const supplier = await tx.supplier.findUnique({
        where: { id: supplierId },
      });

      if (!supplier || supplier.isDeleted || supplier.shopId !== shopId) {
        throw new Error('Supplier not found');
      }

      const paymentDecimal = new Prisma.Decimal(amount.toString());
      const newBalance = supplier.currentBalance.minus(paymentDecimal);

      await tx.supplier.update({
        where: { id: supplierId },
        data: { currentBalance: newBalance },
      });

      return tx.supplierLedger.create({
        data: {
          supplierId,
          type: SupplierLedgerType.PAYMENT,
          amount: paymentDecimal.negated(),
          balanceAfter: newBalance,
          paymentMethod,
          note: note || 'Supplier Payment',
        },
      });
    });
  }

  static async getLedger(supplierId: string) {
    return prisma.supplierLedger.findMany({
      where: { supplierId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
