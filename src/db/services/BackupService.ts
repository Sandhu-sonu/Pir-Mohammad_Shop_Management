import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';
import { BackupRepository } from '../repositories/BackupRepository';
import * as fs from 'fs';
import * as path from 'path';

const BACKUP_DIR = path.join(process.cwd(), 'storage', 'backups');
const BACKUP_VERSION = '1.0';
const SCHEMA_VERSION = '1.0';
const APP_VERSION = '1.0.0';

export class BackupService {
  static getBackupDir() {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    return BACKUP_DIR;
  }

  /**
   * Generates a complete backup for the specified shop
   */
  static async createBackup(shopId: string, userId: string, notes?: string) {
    const startTime = Date.now();
    const backupDir = this.getBackupDir();
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${shopId}-${timestampStr}.json`;
    const filepath = path.join(backupDir, filename);

    try {
      // 1. Fetch business tables (exclude system logs)
      const categories = await prisma.category.findMany({ where: { shopId } });
      const brands = await prisma.brand.findMany({ where: { shopId } });
      const products = await prisma.product.findMany({ where: { shopId } });
      const customers = await prisma.customer.findMany({ where: { shopId } });
      const suppliers = await prisma.supplier.findMany({ where: { shopId } });
      const sales = await prisma.sale.findMany({ where: { shopId } });
      const saleItems = await prisma.saleItem.findMany({
        where: { sale: { shopId } },
      });
      const purchases = await prisma.purchase.findMany({ where: { shopId } });
      const purchaseItems = await prisma.purchaseItem.findMany({
        where: { purchase: { shopId } },
      });
      const purchaseReturns = await prisma.purchaseReturn.findMany({
        where: { purchase: { shopId } },
      });
      const expenses = await prisma.expense.findMany({ where: { shopId } });
      const dailyClosings = await prisma.dailyClosing.findMany({ where: { shopId } });
      const payments = await prisma.payment.findMany({
        where: { customer: { shopId } },
      });
      const customerLedger = await prisma.customerLedger.findMany({
        where: { customer: { shopId } },
      });
      const supplierLedger = await prisma.supplierLedger.findMany({
        where: { supplier: { shopId } },
      });
      const inventoryTransactions = await prisma.inventoryTransaction.findMany({
        where: { product: { shopId } },
      });
      const stockAlerts = await prisma.stockAlert.findMany({
        where: { product: { shopId } },
      });
      const settings = await prisma.settings.findUnique({ where: { shopId } });

      // 2. Build payload structure
      const payload = {
        backupVersion: BACKUP_VERSION,
        schemaVersion: SCHEMA_VERSION,
        appVersion: APP_VERSION,
        shopId,
        timestamp: new Date().toISOString(),
        data: {
          categories,
          brands,
          products,
          customers,
          suppliers,
          sales,
          saleItems,
          purchases,
          purchaseItems,
          purchaseReturns,
          expenses,
          dailyClosings,
          payments,
          customerLedger,
          supplierLedger,
          inventoryTransactions,
          stockAlerts,
          settings,
        },
      };

      // Write payload to disk
      const jsonContent = JSON.stringify(payload, null, 2);
      fs.writeFileSync(filepath, jsonContent, 'utf-8');
      const stats = fs.statSync(filepath);

      const duration = Date.now() - startTime;

      // Save success history entry
      const historyEntry = await BackupRepository.createBackupHistory({
        shopId,
        backupType: 'COMPLETE',
        backupVersion: BACKUP_VERSION,
        schemaVersion: SCHEMA_VERSION,
        appVersion: APP_VERSION,
        filename,
        fileSize: stats.size,
        status: 'SUCCESS',
        duration,
        createdById: userId,
      });

      // 3. Enforce 30 backup retention rule
      await this.pruneOldBackups(shopId);

      return historyEntry;
    } catch (error: any) {
      console.error('Backup creation failed:', error);
      const duration = Date.now() - startTime;
      
      // Save failed history entry
      await BackupRepository.createBackupHistory({
        shopId,
        backupType: 'COMPLETE',
        backupVersion: BACKUP_VERSION,
        schemaVersion: SCHEMA_VERSION,
        appVersion: APP_VERSION,
        filename,
        fileSize: 0,
        status: 'FAILED',
        duration,
        createdById: userId,
      });

      throw error;
    }
  }

  /**
   * Deletes backups exceeding the latest 30 successful entries
   */
  private static async pruneOldBackups(shopId: string) {
    try {
      const backupsToPrune = await BackupRepository.getBackupsToPrune(shopId, 30);
      if (backupsToPrune.length === 0) return;

      const idsToDelete: string[] = [];
      const backupDir = this.getBackupDir();

      for (const backup of backupsToPrune) {
        const filepath = path.join(backupDir, backup.filename);
        if (fs.existsSync(filepath)) {
          try {
            fs.unlinkSync(filepath);
          } catch (err) {
            console.error(`Failed to delete backup file: ${filepath}`, err);
          }
        }
        idsToDelete.push(backup.id);
      }

      await BackupRepository.deleteBackupHistoryRecords(idsToDelete);
      console.log(`Pruned ${idsToDelete.length} old backups successfully.`);
    } catch (err) {
      console.error('Pruning backups failed:', err);
    }
  }

  /**
   * Previews a backup payload contents before restoring
   */
  static validateAndPreviewBackup(shopId: string, jsonContent: string) {
    let payload: any;
    try {
      payload = JSON.parse(jsonContent);
    } catch (err) {
      throw new Error('Invalid JSON format.');
    }

    // 1. Integrity checks
    if (!payload.backupVersion || !payload.schemaVersion || !payload.shopId || !payload.data) {
      throw new Error('Corrupted backup: Missing required header keys.');
    }

    // 2. Shop ID checks (prevent cross-shop restore)
    if (payload.shopId !== shopId) {
      throw new Error('Cross-shop Restore Blocked: Backup does not belong to this shop.');
    }

    // 3. Version compatibility checks
    if (payload.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`Incompatible Backup Schema Version: Backup version is ${payload.schemaVersion}, system expects ${SCHEMA_VERSION}.`);
    }

    const { data } = payload;
    return {
      backupDate: payload.timestamp,
      appVersion: payload.appVersion || 'Unknown',
      schemaVersion: payload.schemaVersion,
      products: data.products?.length || 0,
      customers: data.customers?.length || 0,
      sales: data.sales?.length || 0,
      purchases: data.purchases?.length || 0,
      expenses: data.expenses?.length || 0,
      users: data.users?.length || 0,
      backupVersion: payload.backupVersion,
    };
  }

  /**
   * Restores a backup payload inside a single database transaction
   */
  static async restoreBackup(shopId: string, userId: string, jsonContent: string) {
    // Perform preview validations first
    const preview = this.validateAndPreviewBackup(shopId, jsonContent);
    const payload = JSON.parse(jsonContent);
    const { data } = payload;

    try {
      await prisma.$transaction(async (tx) => {
        // 1. DELETE existing records strictly for this shopId only (Tenant Isolation)
        await tx.stockAlert.deleteMany({ where: { product: { shopId } } });
        await tx.inventoryTransaction.deleteMany({ where: { product: { shopId } } });
        await tx.purchaseReturn.deleteMany({ where: { purchase: { shopId } } });
        await tx.purchaseItem.deleteMany({ where: { purchase: { shopId } } });
        await tx.purchase.deleteMany({ where: { shopId } });
        await tx.saleItem.deleteMany({ where: { sale: { shopId } } });
        await tx.sale.deleteMany({ where: { shopId } });
        await tx.customerLedger.deleteMany({ where: { customer: { shopId } } });
        await tx.payment.deleteMany({ where: { customer: { shopId } } });
        await tx.customer.deleteMany({ where: { shopId } });
        await tx.supplierLedger.deleteMany({ where: { supplier: { shopId } } });
        await tx.supplier.deleteMany({ where: { shopId } });
        await tx.expense.deleteMany({ where: { shopId } });
        await tx.dailyClosing.deleteMany({ where: { shopId } });
        await tx.product.deleteMany({ where: { shopId } });
        await tx.brand.deleteMany({ where: { shopId } });
        await tx.category.deleteMany({ where: { shopId } });
        await tx.settings.deleteMany({ where: { shopId } });

        // 2. INSERT records from backup
        if (data.settings) {
          await tx.settings.create({
            data: {
              id: data.settings.id,
              shopId: data.settings.shopId,
              language: data.settings.language,
              theme: data.settings.theme,
              lowStockAlert: data.settings.lowStockAlert,
            },
          });
        }

        if (data.categories?.length > 0) {
          await tx.category.createMany({ data: data.categories });
        }

        if (data.brands?.length > 0) {
          await tx.brand.createMany({ data: data.brands });
        }

        if (data.customers?.length > 0) {
          const formattedCustomers = data.customers.map((c: any) => ({
            ...c,
            openingBalance: new Prisma.Decimal(c.openingBalance),
            currentBalance: new Prisma.Decimal(c.currentBalance),
          }));
          await tx.customer.createMany({ data: formattedCustomers });
        }

        if (data.suppliers?.length > 0) {
          const formattedSuppliers = data.suppliers.map((s: any) => ({
            ...s,
            currentBalance: new Prisma.Decimal(s.currentBalance),
          }));
          await tx.supplier.createMany({ data: formattedSuppliers });
        }

        if (data.products?.length > 0) {
          const formattedProducts = data.products.map((p: any) => ({
            ...p,
            purchasePrice: new Prisma.Decimal(p.purchasePrice),
            sellingPrice: new Prisma.Decimal(p.sellingPrice),
            currentQuantity: new Prisma.Decimal(p.currentQuantity),
            minStock: new Prisma.Decimal(p.minStock),
          }));
          await tx.product.createMany({ data: formattedProducts });
        }

        if (data.sales?.length > 0) {
          const formattedSales = data.sales.map((s: any) => ({
            ...s,
            total: new Prisma.Decimal(s.total),
            paidAmount: new Prisma.Decimal(s.paidAmount),
            due: new Prisma.Decimal(s.due),
            discount: new Prisma.Decimal(s.discount),
            date: new Date(s.date),
          }));
          await tx.sale.createMany({ data: formattedSales });
        }

        if (data.saleItems?.length > 0) {
          const formattedSaleItems = data.saleItems.map((si: any) => ({
            ...si,
            quantity: new Prisma.Decimal(si.quantity),
            purchasePrice: new Prisma.Decimal(si.purchasePrice),
            sellingPrice: new Prisma.Decimal(si.sellingPrice),
            total: new Prisma.Decimal(si.total),
          }));
          await tx.saleItem.createMany({ data: formattedSaleItems });
        }

        if (data.purchases?.length > 0) {
          const formattedPurchases = data.purchases.map((p: any) => ({
            ...p,
            totalAmount: new Prisma.Decimal(p.totalAmount),
            paidAmount: new Prisma.Decimal(p.paidAmount),
            due: new Prisma.Decimal(p.due),
            date: new Date(p.date),
          }));
          await tx.purchase.createMany({ data: formattedPurchases });
        }

        if (data.purchaseItems?.length > 0) {
          const formattedPurchaseItems = data.purchaseItems.map((pi: any) => ({
            ...pi,
            quantity: new Prisma.Decimal(pi.quantity),
            purchasePrice: new Prisma.Decimal(pi.purchasePrice),
            total: new Prisma.Decimal(pi.total),
          }));
          await tx.purchaseItem.createMany({ data: formattedPurchaseItems });
        }

        if (data.purchaseReturns?.length > 0) {
          const formattedReturns = data.purchaseReturns.map((r: any) => ({
            ...r,
            amount: new Prisma.Decimal(r.amount),
            createdAt: new Date(r.createdAt),
          }));
          await tx.purchaseReturn.createMany({ data: formattedReturns });
        }

        if (data.expenses?.length > 0) {
          const formattedExpenses = data.expenses.map((e: any) => ({
            ...e,
            amount: new Prisma.Decimal(e.amount),
            date: new Date(e.date),
          }));
          await tx.expense.createMany({ data: formattedExpenses });
        }

        if (data.dailyClosings?.length > 0) {
          const formattedClosings = data.dailyClosings.map((dc: any) => ({
            ...dc,
            openingCash: new Prisma.Decimal(dc.openingCash),
            salesCash: new Prisma.Decimal(dc.salesCash),
            salesUpi: new Prisma.Decimal(dc.salesUpi),
            expensesCash: new Prisma.Decimal(dc.expensesCash),
            paymentsReceivedCash: new Prisma.Decimal(dc.paymentsReceivedCash),
            paymentsReceivedUpi: new Prisma.Decimal(dc.paymentsReceivedUpi),
            supplierPaymentsCash: new Prisma.Decimal(dc.supplierPaymentsCash),
            supplierPaymentsUpi: new Prisma.Decimal(dc.supplierPaymentsUpi),
            closingCash: new Prisma.Decimal(dc.closingCash),
            difference: new Prisma.Decimal(dc.difference),
            withdrawals: new Prisma.Decimal(dc.withdrawals),
            date: new Date(dc.date),
          }));
          await tx.dailyClosing.createMany({ data: formattedClosings });
        }

        if (data.payments?.length > 0) {
          const formattedPayments = data.payments.map((p: any) => ({
            ...p,
            amount: new Prisma.Decimal(p.amount),
            createdAt: new Date(p.createdAt),
          }));
          await tx.payment.createMany({ data: formattedPayments });
        }

        if (data.customerLedger?.length > 0) {
          const formattedCustLedgers = data.customerLedger.map((cl: any) => ({
            ...cl,
            amount: new Prisma.Decimal(cl.amount),
            balanceAfter: new Prisma.Decimal(cl.balanceAfter),
            createdAt: new Date(cl.createdAt),
          }));
          await tx.customerLedger.createMany({ data: formattedCustLedgers });
        }

        if (data.supplierLedger?.length > 0) {
          const formattedSupLedgers = data.supplierLedger.map((sl: any) => ({
            ...sl,
            amount: new Prisma.Decimal(sl.amount),
            balanceAfter: new Prisma.Decimal(sl.balanceAfter),
            createdAt: new Date(sl.createdAt),
          }));
          await tx.supplierLedger.createMany({ data: formattedSupLedgers });
        }

        if (data.inventoryTransactions?.length > 0) {
          const formattedInvTx = data.inventoryTransactions.map((it: any) => ({
            ...it,
            quantity: new Prisma.Decimal(it.quantity),
            previousQty: new Prisma.Decimal(it.previousQty),
            newQty: new Prisma.Decimal(it.newQty),
            price: new Prisma.Decimal(it.price),
            createdAt: new Date(it.createdAt),
          }));
          await tx.inventoryTransaction.createMany({ data: formattedInvTx });
        }

        if (data.stockAlerts?.length > 0) {
          const formattedAlerts = data.stockAlerts.map((sa: any) => ({
            ...sa,
            createdAt: new Date(sa.createdAt),
          }));
          await tx.stockAlert.createMany({ data: formattedAlerts });
        }
      });

      // Save restore log success
      await BackupRepository.createRestoreLog({
        shopId,
        status: 'SUCCESS',
        restoredById: userId,
      });

      return { success: true, preview };
    } catch (error: any) {
      console.error('Restore database operation failed:', error);
      
      // Save restore log failure
      await BackupRepository.createRestoreLog({
        shopId,
        status: 'FAILED',
        error: error.message || 'Database transaction rollback.',
        restoredById: userId,
      });

      throw error;
    }
  }
}
