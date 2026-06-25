import { prisma } from '../prisma';
import { ProductRepository } from '../repositories/ProductRepository';
import { CategoryBrandRepository } from '../repositories/CategoryBrandRepository';
import { ProductImportRepository } from '../repositories/ProductImportRepository';
import { InventoryRepository } from '../repositories/InventoryRepository';
import { TransactionType } from '@prisma/client';
import { Prisma } from '@prisma/client';

export type ImportMode = 'CREATE_ONLY' | 'UPSERT' | 'REPLACE_PRICES';

export interface ImportResult {
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  createdCategoriesCount: number;
  createdBrandsCount: number;
  errors: { rowNum: number; sku?: string; errorMsg: string; rawData?: string }[];
}

export class ProductImportService {
  static async importCSV(shopId: string, filename: string, csvContent: string, mode: ImportMode): Promise<ImportResult> {
    const lines = csvContent.split('\n');
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const errors: ImportResult['errors'] = [];

    const newCategories = new Set<string>();
    const newBrands = new Set<string>();

    // Header validation (Expected columns: SKU, Barcode, NameEn, NamePa, Category, Brand, PurchasePrice, SellingPrice, Quantity, Unit, ReorderLevel, TaxRate)
    const header = lines[0]?.trim();
    if (!header) {
      throw new Error('CSV file is empty');
    }

    // Loop through rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const rowNum = i + 1;
      const columns = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));

      // Validate columns count (At least requires NameEn, NamePa, SKU, PurchasePrice, SellingPrice, Unit)
      if (columns.length < 5) {
        failedCount++;
        errors.push({
          rowNum,
          errorMsg: 'Invalid row format: Missing columns',
          rawData: line,
        });
        continue;
      }

      const [
        sku,
        barcode,
        nameEn,
        namePa,
        categoryRaw,
        brandRaw,
        purchasePriceRaw,
        sellingPriceRaw,
        quantityRaw,
        unit,
        reorderLevelRaw,
        taxRateRaw,
      ] = columns;

      // Rule Validation
      if (!sku) {
        failedCount++;
        errors.push({
          rowNum,
          errorMsg: 'Missing SKU: SKU is mandatory',
          rawData: line,
        });
        continue;
      }

      if (!nameEn || !namePa) {
        failedCount++;
        errors.push({
          rowNum,
          sku,
          errorMsg: 'Missing Product Names (English or Punjabi name required)',
          rawData: line,
        });
        continue;
      }

      const purchasePrice = parseFloat(purchasePriceRaw || '0');
      const sellingPrice = parseFloat(sellingPriceRaw || '0');
      const quantity = parseFloat(quantityRaw || '0');
      const reorderLevel = parseFloat(reorderLevelRaw || '5');
      const taxRate = parseFloat(taxRateRaw || '0');

      if (isNaN(purchasePrice) || purchasePrice < 0 || isNaN(sellingPrice) || sellingPrice < 0) {
        failedCount++;
        errors.push({
          rowNum,
          sku,
          errorMsg: 'Invalid pricing: prices cannot be negative',
          rawData: line,
        });
        continue;
      }

      try {
        // Run database queries inside a transaction per row
        await prisma.$transaction(async (tx) => {
          // Check if SKU exists
          const existingProduct = await tx.product.findFirst({
            where: { shopId, sku, isDeleted: false },
          });

          // Resolve Category and Brand (auto-create and normalize case-insensitively)
          let category = null;
          if (categoryRaw && categoryRaw.trim()) {
            const rawNormalized = categoryRaw.trim();
            const existingCat = await tx.category.findFirst({
              where: { shopId, name: { equals: rawNormalized, mode: 'insensitive' } }
            });
            if (!existingCat) {
              newCategories.add(rawNormalized.toLowerCase());
            }
            category = await CategoryBrandRepository.findOrCreateCategory(tx, shopId, categoryRaw);
          }

          let brand = null;
          if (brandRaw && brandRaw.trim()) {
            const rawNormalized = brandRaw.trim();
            const existingBrand = await tx.brand.findFirst({
              where: { shopId, name: { equals: rawNormalized, mode: 'insensitive' } }
            });
            if (!existingBrand) {
              newBrands.add(rawNormalized.toLowerCase());
            }
            brand = await CategoryBrandRepository.findOrCreateBrand(tx, shopId, brandRaw);
          }

          if (existingProduct) {
            if (mode === 'CREATE_ONLY') {
              // Skip row
              skippedCount++;
              return;
            }

            const updateData: Prisma.ProductUncheckedUpdateInput = {
              nameEn,
              namePa,
              categoryName: category?.name || null,
              categoryId: category?.id || null,
              brandId: brand?.id || null,
              reorderLevel: new Prisma.Decimal(reorderLevel.toString()),
              taxRate: new Prisma.Decimal(taxRate.toString()),
              barcode: barcode || existingProduct.barcode,
            };

            // Double Check: do NOT overwrite stock for UPSERT mode. Stock only changes via transactions
            if (mode === 'REPLACE_PRICES' || mode === 'UPSERT') {
              updateData.purchasePrice = new Prisma.Decimal(purchasePrice.toString());
              updateData.sellingPrice = new Prisma.Decimal(sellingPrice.toString());
            }

            await tx.product.update({
              where: { id: existingProduct.id },
              data: updateData,
            });

            updatedCount++;
          } else {
            // Create New Product
            const newProduct = await tx.product.create({
              data: {
                sku,
                barcode: barcode || null,
                nameEn,
                namePa,
                categoryName: category?.name || null,
                categoryId: category?.id || null,
                brandId: brand?.id || null,
                purchasePrice: new Prisma.Decimal(purchasePrice.toString()),
                sellingPrice: new Prisma.Decimal(sellingPrice.toString()),
                currentQuantity: new Prisma.Decimal(quantity.toString()),
                unit: unit || 'PCS',
                reorderLevel: new Prisma.Decimal(reorderLevel.toString()),
                taxRate: new Prisma.Decimal(taxRate.toString()),
                shopId,
              },
            });

            // If initial stock > 0, log opening inventory transaction
            if (quantity > 0) {
              await tx.inventoryTransaction.create({
                data: {
                  productId: newProduct.id,
                  type: TransactionType.PURCHASE,
                  quantity: new Prisma.Decimal(quantity.toString()),
                  previousQty: 0,
                  newQty: new Prisma.Decimal(quantity.toString()),
                  price: new Prisma.Decimal(purchasePrice.toString()),
                  note: 'Opening stock from bulk import',
                },
              });
            }

            importedCount++;
          }
        });
      } catch (err: any) {
        failedCount++;
        errors.push({
          rowNum,
          sku,
          errorMsg: `DB Error: ${err.message}`,
          rawData: line,
        });
      }
    }

    // Save batch summary to ProductImport log table
    await ProductImportRepository.createImportLog({
      shopId,
      filename,
      importedCount,
      updatedCount,
      failedCount,
      createdCategoriesCount: newCategories.size,
      createdBrandsCount: newBrands.size,
      status: failedCount > 0 ? 'PARTIAL' : 'COMPLETED',
      errors,
    });

    return {
      importedCount,
      updatedCount,
      skippedCount,
      failedCount,
      createdCategoriesCount: newCategories.size,
      createdBrandsCount: newBrands.size,
      errors,
    };
  }
}
