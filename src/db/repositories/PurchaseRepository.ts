import { prisma } from '../prisma';
import { Prisma, PurchaseStatus, SupplierLedgerType, TransactionType } from '@prisma/client';
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
  status: PurchaseStatus; // DRAFT or RECEIVED
}

export class PurchaseRepository {
  static async findById(id: string) {
    return prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
        purchaseReturns: true,
      },
    });
  }

  static async findAll(shopId: string) {
    return prisma.purchase.findMany({
      where: { shopId },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  static async create(data: CreatePurchaseInput) {
    const { shopId, supplierId, items, invoiceNumber, note, paidAmount, status } = data;

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
          status,
        },
      });

      // Create items
      for (const rItem of resolvedItems) {
        await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            productId: rItem.productId,
            quantity: rItem.quantity,
            purchasePrice: rItem.purchasePrice,
          },
        });
      }

      // ONLY adjust inventory and ledger if status is RECEIVED (or COMPLETED)
      if (status === PurchaseStatus.RECEIVED || status === PurchaseStatus.COMPLETED) {
        for (const rItem of resolvedItems) {
          await InventoryRepository.adjustStock(tx, {
            productId: rItem.productId,
            quantity: rItem.quantity.toNumber(),
            type: TransactionType.PURCHASE,
            price: rItem.purchasePrice.toNumber(),
            referenceId: purchase.id,
            note: `Purchase Invoice Received: ${invoiceNumber || purchase.id}`,
          });
        }

        // Update Supplier outstanding balance (due adds to what we owe)
        const newBalance = supplier.currentBalance.plus(due);
        await tx.supplier.update({
          where: { id: supplierId },
          data: { currentBalance: newBalance },
        });

        // Supplier Ledger (PURCHASE)
        await tx.supplierLedger.create({
          data: {
            supplierId,
            type: SupplierLedgerType.PURCHASE,
            amount: total,
            balanceAfter: supplier.currentBalance.plus(total),
            referenceId: purchase.id,
            note: `Purchase Received: ${invoiceNumber || purchase.id}`,
          },
        });

        // Supplier Ledger (PAYMENT)
        if (paid.greaterThan(0)) {
          await tx.supplierLedger.create({
            data: {
              supplierId,
              type: SupplierLedgerType.PAYMENT,
              amount: paid.negated(),
              balanceAfter: newBalance,
              referenceId: purchase.id,
              note: `Payment for Purchase: ${invoiceNumber || purchase.id}`,
            },
          });
        }
      }

      return purchase;
    });
  }

  static async transitionStatus(purchaseId: string, newStatus: PurchaseStatus, paidAmountInput?: number) {
    return prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id: purchaseId },
        include: { items: true },
      });

      if (!purchase) throw new Error('Purchase order not found');
      if (purchase.status === newStatus) return purchase;

      // Rule: Inventory updates ONLY when transitioning to RECEIVED / COMPLETED
      const becameReceived =
        (newStatus === PurchaseStatus.RECEIVED || newStatus === PurchaseStatus.COMPLETED) &&
        purchase.status === PurchaseStatus.DRAFT;

      if (becameReceived) {
        const supplier = await tx.supplier.findUnique({
          where: { id: purchase.supplierId },
        });

        if (!supplier || supplier.isDeleted) {
          throw new Error('Supplier not found');
        }

        // Update Stock
        for (const item of purchase.items) {
          await InventoryRepository.adjustStock(tx, {
            productId: item.productId,
            quantity: item.quantity.toNumber(),
            type: TransactionType.PURCHASE,
            price: item.purchasePrice.toNumber(),
            referenceId: purchase.id,
            note: `Purchase Invoice Transition to Received: ${purchase.invoiceNumber || purchase.id}`,
          });
        }

        const paid = new Prisma.Decimal((paidAmountInput !== undefined ? paidAmountInput : purchase.paidAmount).toString());
        const due = purchase.total.minus(paid);

        // Update supplier balance
        const newBalance = supplier.currentBalance.plus(due);
        await tx.supplier.update({
          where: { id: purchase.supplierId },
          data: { currentBalance: newBalance },
        });

        // Create Supplier Ledger entries
        await tx.supplierLedger.create({
          data: {
            supplierId: purchase.supplierId,
            type: SupplierLedgerType.PURCHASE,
            amount: purchase.total,
            balanceAfter: supplier.currentBalance.plus(purchase.total),
            referenceId: purchase.id,
            note: `Purchase Received Transition: ${purchase.invoiceNumber || purchase.id}`,
          },
        });

        if (paid.greaterThan(0)) {
          await tx.supplierLedger.create({
            data: {
              supplierId: purchase.supplierId,
              type: SupplierLedgerType.PAYMENT,
              amount: paid.negated(),
              balanceAfter: newBalance,
              referenceId: purchase.id,
              note: `Payment for Purchase: ${purchase.invoiceNumber || purchase.id}`,
            },
          });
        }

        // Update purchase record
        return tx.purchase.update({
          where: { id: purchaseId },
          data: {
            status: newStatus,
            paidAmount: paid,
            dueAmount: due,
          },
        });
      }

      // If transition is just to CANCELLED from DRAFT
      if (newStatus === PurchaseStatus.CANCELLED) {
        if (purchase.status !== PurchaseStatus.DRAFT) {
          // Cannot cancel received directly without reversal rules if stock was already altered
          throw new Error('Cannot cancel a received purchase order directly. Perform returns instead.');
        }

        return tx.purchase.update({
          where: { id: purchaseId },
          data: { status: PurchaseStatus.CANCELLED },
        });
      }

      // For other simple status updates (e.g. COMPLETED / PARTIAL without changing ledger)
      return tx.purchase.update({
        where: { id: purchaseId },
        data: { status: newStatus },
      });
    });
  }
}
