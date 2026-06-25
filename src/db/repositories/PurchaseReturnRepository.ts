import { prisma } from '../prisma';
import { Prisma, SupplierLedgerType, TransactionType } from '@prisma/client';
import { InventoryRepository } from './InventoryRepository';

export interface CreatePurchaseReturnInput {
  purchaseId: string;
  productId: string;
  quantity: number;
  reason?: string;
}

export class PurchaseReturnRepository {
  static async createReturn(data: CreatePurchaseReturnInput) {
    const { purchaseId, productId, quantity, reason } = data;
    const returnQty = new Prisma.Decimal(quantity.toString());

    if (quantity <= 0) {
      throw new Error('Return quantity must be greater than zero');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Fetch the purchase order
      const purchase = await tx.purchase.findUnique({
        where: { id: purchaseId },
        include: { supplier: true },
      });

      if (!purchase) {
        throw new Error('Purchase order not found');
      }

      // Check if purchase order is in a status that received stock
      const hasReceived =
        purchase.status === 'RECEIVED' ||
        purchase.status === 'COMPLETED' ||
        purchase.status === 'PARTIAL';

      if (!hasReceived) {
        throw new Error('Cannot return items for a purchase that is not yet received');
      }

      // 2. Fetch the corresponding purchase item
      const purchaseItem = await tx.purchaseItem.findFirst({
        where: { purchaseId, productId },
      });

      if (!purchaseItem) {
        throw new Error('Product was not part of this purchase order');
      }

      // 3. Check existing returns for this product and purchase
      const pastReturns = await tx.purchaseReturn.findMany({
        where: { purchaseId, productId },
      });

      const totalReturned = pastReturns.reduce(
        (sum, ret) => sum.plus(ret.quantity),
        new Prisma.Decimal('0')
      );

      const purchaseQty = purchaseItem.quantity;
      const remainingQty = purchaseQty.minus(totalReturned);

      if (returnQty.greaterThan(remainingQty)) {
        throw new Error(
          `Cannot return more than purchased. Purchased: ${purchaseQty}, Already Returned: ${totalReturned}, Remaining: ${remainingQty}, Requested: ${returnQty}`
        );
      }

      const supplier = await tx.supplier.findUnique({
        where: { id: purchase.supplierId },
      });

      if (!supplier || supplier.isDeleted) {
        throw new Error('Supplier not found');
      }

      // 4. Create the PurchaseReturn record
      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          purchaseId,
          productId,
          quantity: returnQty,
          purchasePrice: purchaseItem.purchasePrice,
          reason: reason || null,
        },
      });

      // 5. Reduce stock atomically (negative adjustment)
      await InventoryRepository.adjustStock(tx, {
        productId,
        quantity: -quantity, // Negative quantity to reduce stock
        type: TransactionType.RETURN,
        price: purchaseItem.purchasePrice.toNumber(),
        referenceId: purchaseReturn.id,
        note: `Purchase Return for invoice: ${purchase.invoiceNumber || purchase.id}`,
      });

      // 6. Reduce Supplier outstanding balance
      const returnAmount = returnQty.times(purchaseItem.purchasePrice);
      const newBalance = supplier.currentBalance.minus(returnAmount);

      await tx.supplier.update({
        where: { id: purchase.supplierId },
        data: { currentBalance: newBalance },
      });

      // 7. Log Supplier Ledger entry (RETURN Ledger has negative amount as it reduces our due)
      await tx.supplierLedger.create({
        data: {
          supplierId: purchase.supplierId,
          type: SupplierLedgerType.RETURN,
          amount: returnAmount.negated(), // negative amount reduces what we owe
          balanceAfter: newBalance,
          referenceId: purchaseReturn.id,
          note: `Purchase Return: ${purchase.invoiceNumber || purchase.id}. Items: ${quantity}`,
        },
      });

      return purchaseReturn;
    });
  }

  static async getReturnsForPurchase(purchaseId: string) {
    return prisma.purchaseReturn.findMany({
      where: { purchaseId },
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
