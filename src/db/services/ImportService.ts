import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

export interface ProductImportInput {
  sku: string;
  nameEn: string;
  namePa: string;
  purchasePrice: number;
  sellingPrice: number;
  currentQuantity?: number;
  minStock?: number;
  unit?: string;
  category?: string;
  brand?: string;
}

export interface CustomerImportInput {
  name: string;
  mobile: string;
  email?: string;
  address?: string;
  openingBalance?: number;
}

export interface SupplierImportInput {
  name: string;
  mobile: string;
  email?: string;
  address?: string;
  gst?: string;
}

export class ImportService {
  /**
   * Import products with SKU-based deduplication
   */
  static async importProducts(shopId: string, rows: ProductImportInput[]) {
    let imported = 0;
    let updated = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        // Validate required fields
        if (!row.sku || !row.nameEn || row.purchasePrice < 0 || row.sellingPrice < 0) {
          failed++;
          continue;
        }

        const sku = row.sku.trim();
        const nameEn = row.nameEn.trim();
        const namePa = (row.namePa || nameEn).trim();
        const purchasePrice = new Prisma.Decimal(row.purchasePrice.toString());
        const sellingPrice = new Prisma.Decimal(row.sellingPrice.toString());
        const minStock = new Prisma.Decimal((row.minStock ?? 5).toString());
        const currentQty = new Prisma.Decimal((row.currentQuantity ?? 0).toString());
        const unit = (row.unit || 'PCS').trim();

        // 1. Get or create category
        let categoryId: string | null = null;
        if (row.category && row.category.trim()) {
          const catName = row.category.trim();
          const normalized = catName.charAt(0).toUpperCase() + catName.slice(1).toLowerCase();
          const cat = await prisma.category.upsert({
            where: { shopId_name: { shopId, name: normalized } },
            create: { shopId, name: normalized },
            update: {},
          });
          categoryId = cat.id;
        }

        // 2. Get or create brand
        let brandId: string | null = null;
        if (row.brand && row.brand.trim()) {
          const brandName = row.brand.trim();
          const normalized = brandName.charAt(0).toUpperCase() + brandName.slice(1).toLowerCase();
          const brd = await prisma.brand.upsert({
            where: { shopId_name: { shopId, name: normalized } },
            create: { shopId, name: normalized },
            update: {},
          });
          brandId = brd.id;
        }

        // 3. Match product on SKU
        const existing = await prisma.product.findFirst({
          where: { shopId, sku, isDeleted: false },
        });

        if (existing) {
          // Update product (Deterministic Duplicate Rule)
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              nameEn,
              namePa,
              purchasePrice,
              sellingPrice,
              minStock,
              unit,
              categoryId,
              brandId,
            },
          });
          updated++;
        } else {
          // Create product
          await prisma.product.create({
            data: {
              shopId,
              sku,
              nameEn,
              namePa,
              purchasePrice,
              sellingPrice,
              currentQuantity: currentQty,
              minStock,
              unit,
              categoryId,
              brandId,
            },
          });
          imported++;
        }
      } catch (err) {
        console.error('Failed to import product row:', row, err);
        failed++;
      }
    }

    return { imported, updated, failed };
  }

  /**
   * Import customers matching on Name + Mobile
   */
  static async importCustomers(shopId: string, rows: CustomerImportInput[]) {
    let imported = 0;
    let updated = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        if (!row.name || !row.mobile) {
          failed++;
          continue;
        }

        const name = row.name.trim();
        const mobile = row.mobile.trim();
        const openingBalance = new Prisma.Decimal((row.openingBalance ?? 0).toString());

        // Match on Name + Mobile
        const existing = await prisma.customer.findFirst({
          where: { shopId, name, mobile, isDeleted: false },
        });

        if (existing) {
          await prisma.customer.update({
            where: { id: existing.id },
            data: {
              address: row.address ? row.address.trim() : existing.address,
            },
          });
          updated++;
        } else {
          await prisma.customer.create({
            data: {
              shopId,
              name,
              mobile,
              address: row.address ? row.address.trim() : null,
              openingBalance,
              currentBalance: openingBalance,
            },
          });
          imported++;
        }
      } catch (err) {
        console.error('Failed to import customer row:', row, err);
        failed++;
      }
    }

    return { imported, updated, failed };
  }

  /**
   * Import suppliers matching on Name + Mobile
   */
  static async importSuppliers(shopId: string, rows: SupplierImportInput[]) {
    let imported = 0;
    let updated = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        if (!row.name || !row.mobile) {
          failed++;
          continue;
        }

        const name = row.name.trim();
        const mobile = row.mobile.trim();

        // Match on Name + Mobile
        const existing = await prisma.supplier.findFirst({
          where: { shopId, name, mobile, isDeleted: false },
        });

        if (existing) {
          await prisma.supplier.update({
            where: { id: existing.id },
            data: {
              gst: row.gst ? row.gst.trim() : existing.gst,
            },
          });
          updated++;
        } else {
          await prisma.supplier.create({
            data: {
              shopId,
              name,
              mobile,
              gst: row.gst ? row.gst.trim() : null,
              currentBalance: new Prisma.Decimal('0.00'),
            },
          });
          imported++;
        }
      } catch (err) {
        console.error('Failed to import supplier row:', row, err);
        failed++;
      }
    }

    return { imported, updated, failed };
  }
}
