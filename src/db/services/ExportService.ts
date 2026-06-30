import { prisma } from '../prisma';
import { BackupRepository } from '../repositories/BackupRepository';
import { getBusinessProfile } from '../../lib/businessProfiles';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const EXPORT_DIR = path.join(process.cwd(), 'storage', 'exports');

export class ExportService {
  static getExportDir() {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
    return EXPORT_DIR;
  }

  /**
   * Triggers an export. Small exports (< 10k rows) run synchronously.
   * Large exports run in the background.
   */
  static async triggerExport(
    shopId: string,
    userId: string,
    module: string,
    format: string
  ) {
    const exportDir = this.getExportDir();
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = format.toLowerCase() === 'excel' ? 'xlsx' : format.toLowerCase();
    const filename = `export-${module}-${timestampStr}.${ext}`;
    const filepath = path.join(exportDir, filename);

    // 1. Estimate count of records
    const count = await this.getRecordCount(shopId, module);

    // Create pending export history entry
    const exportLog = await BackupRepository.createExportHistory({
      shopId,
      module,
      format,
      filename,
      status: count > 10000 ? 'PENDING' : 'SUCCESS',
      progress: count > 10000 ? 0 : 100,
      createdById: userId,
    });

    if (count > 10000) {
      // Execute in background
      this.runBackgroundExport(exportLog.id, shopId, module, format, filepath);
      return { background: true, exportId: exportLog.id };
    } else {
      // Process synchronously
      try {
        const rows = await this.fetchExportData(shopId, module);
        this.writeFile(filepath, rows, format);
        const stats = fs.statSync(filepath);
        
        await BackupRepository.updateExportProgress(
          exportLog.id,
          100,
          'SUCCESS',
          stats.size
        );

        return { background: false, filename };
      } catch (err: any) {
        console.error('Synchronous export failed:', err);
        await BackupRepository.updateExportProgress(exportLog.id, 0, 'FAILED');
        throw err;
      }
    }
  }

  /**
   * Retrieves data row count for the module
   */
  private static async getRecordCount(shopId: string, module: string): Promise<number> {
    switch (module.toUpperCase()) {
      case 'PRODUCTS':
        return prisma.product.count({ where: { shopId, isDeleted: false } });
      case 'CUSTOMERS':
        return prisma.customer.count({ where: { shopId, isDeleted: false } });
      case 'SUPPLIERS':
        return prisma.supplier.count({ where: { shopId, isDeleted: false } });
      case 'SALES':
        return prisma.sale.count({ where: { shopId } });
      case 'PURCHASES':
        return prisma.purchase.count({ where: { shopId } });
      case 'EXPENSES':
        return prisma.expense.count({ where: { shopId } });
      case 'INVENTORY':
        return prisma.product.count({ where: { shopId, isDeleted: false } });
      default:
        return 0;
    }
  }

  /**
   * Fetches rows from database, mapped to standard display key properties
   */
  private static async fetchExportData(shopId: string, module: string): Promise<any[]> {
    switch (module.toUpperCase()) {
      case 'PRODUCTS': {
        const shop = await prisma.shop.findUnique({ where: { id: shopId } });
        const businessType = shop?.businessType || 'GENERAL_STORE';
        const profile = getBusinessProfile(businessType);

        const list = await prisma.product.findMany({
          where: { shopId, isDeleted: false },
          include: { category: true, brand: true },
        });

        const excludedFields = [
          'sku', 'barcode', 'nameEn', 'namePa', 'categoryName', 'brandName',
          'purchasePrice', 'sellingPrice', 'currentQuantity', 'unit', 'minStock',
          'reorderLevel', 'taxRate', 'isActive', 'supplierId'
        ];

        return list.map(p => {
          const row: any = {
            SKU: p.sku,
            NameEnglish: p.nameEn,
            NamePunjabi: p.namePa,
            PurchasePrice: Number(p.purchasePrice),
            SellingPrice: Number(p.sellingPrice),
            Stock: Number(p.currentQuantity),
            MinAlertLimit: Number(p.minStock),
            Unit: p.unit,
            Category: p.category?.name || '',
            Brand: p.brand?.name || '',
          };

          for (const field of profile.fields) {
            if (field.visible && !excludedFields.includes(field.name)) {
              const val = (p as any)[field.name];
              if (val instanceof Date) {
                row[field.name.toUpperCase()] = val.toISOString().slice(0, 10);
              } else if (val && typeof val === 'object' && 'toNumber' in val) {
                row[field.name.toUpperCase()] = val.toNumber();
              } else {
                row[field.name.toUpperCase()] = val !== null && val !== undefined ? val : '';
              }
            }
          }
          return row;
        });
      }
      case 'CUSTOMERS': {
        const list = await prisma.customer.findMany({
          where: { shopId, isDeleted: false },
        });
        return list.map(c => ({
          Name: c.name,
          Mobile: c.mobile,
          Address: c.address || '',
          Notes: c.notes || '',
          OpeningBalance: Number(c.openingBalance),
          CurrentOutstanding: Number(c.currentBalance),
        }));
      }
      case 'SUPPLIERS': {
        const list = await prisma.supplier.findMany({
          where: { shopId, isDeleted: false },
        });
        return list.map(s => ({
          Name: s.name,
          Mobile: s.mobile,
          GST: s.gst || '',
          BalanceOwed: Number(s.currentBalance),
        }));
      }
      case 'SALES': {
        const list = await prisma.sale.findMany({
          where: { shopId },
          include: { customer: true },
        });
        return list.map(s => ({
          InvoiceNumber: s.invoiceNumber,
          Date: s.date.toISOString(),
          Customer: s.customer?.name || 'Walk-in Customer',
          PaymentMethod: s.paymentMethod,
          PaidAmount: Number(s.paidAmount),
          TotalAmount: Number(s.total),
          Due: Number(s.dueAmount),
          Status: s.isReversed ? 'REVERSED' : 'ACTIVE',
        }));
      }
      case 'PURCHASES': {
        const list = await prisma.purchase.findMany({
          where: { shopId },
          include: { supplier: true },
        });
        return list.map(p => ({
          InvoiceNumber: p.invoiceNumber || p.id.slice(0, 8),
          Supplier: p.supplier.name,
          Date: p.date.toISOString(),
          Status: p.status,
          PaidAmount: Number(p.paidAmount),
          TotalAmount: Number(p.total),
          Due: Number(p.dueAmount),
        }));
      }
      case 'EXPENSES': {
        const list = await prisma.expense.findMany({
          where: { shopId },
        });
        return list.map(e => ({
          Date: e.date.toISOString(),
          Category: e.category,
          Amount: Number(e.amount),
          PaymentMethod: e.paymentMethod,
          Description: e.description || '',
          Notes: e.notes || '',
          Status: e.isReversed ? 'REVERSED' : 'ACTIVE',
        }));
      }
      case 'INVENTORY': {
        const list = await prisma.product.findMany({
          where: { shopId, isDeleted: false },
        });
        return list.map(p => ({
          SKU: p.sku,
          ProductName: p.nameEn,
          PurchaseCost: Number(p.purchasePrice),
          SellingPrice: Number(p.sellingPrice),
          StockLevel: Number(p.currentQuantity),
          ValuationAtCost: Number(p.currentQuantity) * Number(p.purchasePrice),
          ValuationAtRetail: Number(p.currentQuantity) * Number(p.sellingPrice),
        }));
      }
      default:
        return [];
    }
  }

  /**
   * Writes data rows to file using JSON, CSV or XLSX
   */
  private static writeFile(filepath: string, rows: any[], format: string) {
    const fmt = format.toUpperCase();
    if (fmt === 'JSON') {
      fs.writeFileSync(filepath, JSON.stringify(rows, null, 2), 'utf-8');
    } else if (fmt === 'CSV') {
      const csvContent = this.convertToCSV(rows);
      fs.writeFileSync(filepath, csvContent, 'utf-8');
    } else if (fmt === 'EXCEL') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Exported Data');
      XLSX.writeFile(wb, filepath);
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Simple CSV converter helper
   */
  private static convertToCSV(rows: any[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const csvRows = [headers.join(',')];

    for (const row of rows) {
      const values = headers.map(header => {
        const val = row[header];
        const strVal = val === null || val === undefined ? '' : '' + val;
        // Escape quotes
        const escaped = strVal.replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Asynchronous background export processor
   */
  private static async runBackgroundExport(
    exportId: string,
    shopId: string,
    module: string,
    format: string,
    filepath: string
  ) {
    try {
      // Simulate progress percentages
      await new Promise(r => setTimeout(r, 200));
      await BackupRepository.updateExportProgress(exportId, 25, 'PENDING');
      
      const rows = await this.fetchExportData(shopId, module);
      
      await new Promise(r => setTimeout(r, 200));
      await BackupRepository.updateExportProgress(exportId, 50, 'PENDING');
      
      this.writeFile(filepath, rows, format);
      
      await new Promise(r => setTimeout(r, 200));
      await BackupRepository.updateExportProgress(exportId, 75, 'PENDING');
      
      const stats = fs.statSync(filepath);
      await BackupRepository.updateExportProgress(exportId, 100, 'SUCCESS', stats.size);
    } catch (err: any) {
      console.error(`Background export ${exportId} failed:`, err);
      await BackupRepository.updateExportProgress(exportId, 0, 'FAILED');
    }
  }
}
