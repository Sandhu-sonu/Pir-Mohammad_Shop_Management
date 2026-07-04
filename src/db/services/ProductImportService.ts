import { prisma } from '../prisma';
import { ProductRepository } from '../repositories/ProductRepository';
import { CategoryBrandRepository } from '../repositories/CategoryBrandRepository';
import { ProductImportRepository } from '../repositories/ProductImportRepository';
import { InventoryRepository } from '../repositories/InventoryRepository';
import { TransactionType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { getBusinessProfile } from '../../lib/businessProfiles';

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

    // Header validation
    const header = lines[0]?.trim();
    if (!header) {
      throw new Error('CSV file is empty');
    }

    // Parse headers case-insensitively
    const rawHeaders = header.split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
    
    const getIndex = (aliases: string[]) => {
      return rawHeaders.findIndex((h) => aliases.includes(h));
    };

    const skuIdx = getIndex(['sku', 'product sku', 'product_sku']);
    const barcodeIdx = getIndex(['barcode']);
    const nameEnIdx = getIndex(['nameenglish', 'nameen', 'name english', 'name_en']);
    const namePaIdx = getIndex(['namepunjabi', 'namepa', 'name punjabi', 'name_pa']);
    const categoryIdx = getIndex(['category', 'categoryname', 'category_name']);
    const brandIdx = getIndex(['brand', 'brandname', 'brand_name']);
    const purchasePriceIdx = getIndex(['purchaseprice', 'purchase price', 'purchase_price']);
    const sellingPriceIdx = getIndex(['sellingprice', 'selling price', 'selling_price']);
    const qtyIdx = getIndex(['stock', 'quantity', 'initial quantity', 'currentquantity', 'initial_quantity']);
    const unitIdx = getIndex(['unit']);
    const minStockIdx = getIndex(['minalertlimit', 'minstock', 'reorder level', 'reorderlevel', 'min_stock']);
    const taxRateIdx = getIndex(['taxrate', 'tax rate', 'tax_rate']);

    // Check mandatory fields
    if (skuIdx === -1 || nameEnIdx === -1 || purchasePriceIdx === -1 || sellingPriceIdx === -1) {
      throw new Error('CSV is missing mandatory headers (SKU, NameEnglish, PurchasePrice, SellingPrice)');
    }

    // Optional fields mapping
    const optionalFields = [
      'manufacturer', 'modelNumber', 'batchNumber', 'expiryDate',
      'manufacturingDate', 'warrantyMonths', 'serialNumber', 'imei',
      'color', 'size', 'variant', 'hsnCode', 'gstRate'
    ];
    
    const optionalIndices: Record<string, number> = {};
    for (const field of optionalFields) {
      const fieldLower = field.toLowerCase();
      optionalIndices[field] = getIndex([
        fieldLower,
        fieldLower.replace(/([a-z])([a-z]+)/g, '$1 $2'),
        fieldLower.replace(/([a-z])([a-z]+)/g, '$1_$2'),
      ]);
    }

    // Fetch shop business type profile
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    const businessType = shop?.businessType || 'GENERAL_STORE';
    const profile = getBusinessProfile(businessType);

    const excludedFieldsStatic = [
      'sku', 'barcode', 'nameEn', 'namePa', 'categoryName', 'brandName',
      'purchasePrice', 'sellingPrice', 'currentQuantity', 'unit', 'minStock',
      'reorderLevel', 'taxRate', 'isActive', 'supplierId'
    ];

    // Loop through rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const rowNum = i + 1;
      const columns = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));

      // Validate columns length
      if (columns.length < 4) {
        failedCount++;
        errors.push({
          rowNum,
          errorMsg: 'Invalid row format: Missing columns',
          rawData: line,
        });
        continue;
      }

      const sku = columns[skuIdx];
      const barcode = barcodeIdx !== -1 && barcodeIdx < columns.length ? columns[barcodeIdx] : undefined;
      const nameEn = columns[nameEnIdx];
      const namePa = namePaIdx !== -1 && namePaIdx < columns.length ? columns[namePaIdx] : nameEn;
      const categoryRaw = categoryIdx !== -1 && categoryIdx < columns.length ? columns[categoryIdx] : 'General';
      const brandRaw = brandIdx !== -1 && brandIdx < columns.length ? columns[brandIdx] : undefined;
      const purchasePriceRaw = purchasePriceIdx !== -1 && purchasePriceIdx < columns.length ? columns[purchasePriceIdx] : '0';
      const sellingPriceRaw = sellingPriceIdx !== -1 && sellingPriceIdx < columns.length ? columns[sellingPriceIdx] : '0';
      const quantityRaw = qtyIdx !== -1 && qtyIdx < columns.length ? columns[qtyIdx] : '0';
      const unit = unitIdx !== -1 && unitIdx < columns.length ? columns[unitIdx] : profile.defaultUnit;
      const reorderLevelRaw = minStockIdx !== -1 && minStockIdx < columns.length ? columns[minStockIdx] : '5';
      const taxRateRaw = taxRateIdx !== -1 && taxRateIdx < columns.length ? columns[taxRateIdx] : '0';

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

      if (!nameEn) {
        failedCount++;
        errors.push({
          rowNum,
          sku,
          errorMsg: 'Missing Product Name (English)',
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
        // Validate and gather optional business profile columns
        const optionalData: any = {};
        for (const field of profile.fields) {
          if (!excludedFieldsStatic.includes(field.name)) {
            const idx = optionalIndices[field.name];
            let val = idx !== undefined && idx !== -1 && idx < columns.length ? columns[idx] : undefined;
            if (val === '') val = undefined;

            if (field.visible && field.required && (val === undefined || val === null || val === '')) {
              throw new Error(`${field.name.toUpperCase()} is required for business type ${profile.displayName}`);
            }

            if (val !== undefined) {
              if (field.name === 'warrantyMonths') {
                optionalData.warrantyMonths = parseInt(val, 10);
              } else if (field.name === 'expiryDate' || field.name === 'manufacturingDate') {
                optionalData[field.name] = new Date(val);
              } else if (field.name === 'gstRate') {
                optionalData.gstRate = new Prisma.Decimal(val);
              } else {
                optionalData[field.name] = val;
              }
            }
          }
        }

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
              ...optionalData,
            };

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
                unit: unit || profile.defaultUnit,
                reorderLevel: new Prisma.Decimal(reorderLevel.toString()),
                taxRate: new Prisma.Decimal(taxRate.toString()),
                shopId,
                ...optionalData,
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
        }, { timeout: 60000 });
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
