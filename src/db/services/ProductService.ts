import { prisma } from '../prisma';
import { ProductRepository, ProductFilterInput } from '../repositories/ProductRepository';
import { CategoryBrandRepository } from '../repositories/CategoryBrandRepository';
import { Prisma, TransactionType } from '@prisma/client';
import { getBusinessProfile } from '../../lib/businessProfiles';

export class ProductService {
  static async getProduct(id: string) {
    return ProductRepository.findById(id);
  }

  static async getProductByBarcode(shopId: string, barcode: string) {
    return ProductRepository.findByBarcode(shopId, barcode);
  }

  static async listProducts(filters: ProductFilterInput) {
    return ProductRepository.findAll(filters);
  }

  static async addProduct(data: {
    shopId: string;
    sku?: string;
    barcode?: string;
    nameEn: string;
    namePa: string;
    category?: string;
    brand?: string;
    purchasePrice: number;
    sellingPrice: number;
    currentQuantity: number;
    unit: string;
    minStock: number;
    supplierId?: string;

    // Optional attributes (Phase 9)
    manufacturer?: string;
    modelNumber?: string;
    batchNumber?: string;
    expiryDate?: Date | string;
    manufacturingDate?: Date | string;
    warrantyMonths?: number;
    serialNumber?: string;
    imei?: string;
    color?: string;
    size?: string;
    variant?: string;
    hsnCode?: string;
    gstRate?: number;
  }) {
    if (data.purchasePrice < 0 || data.sellingPrice < 0) {
      throw new Error('Prices cannot be negative');
    }
    if (data.currentQuantity < 0) {
      throw new Error('Initial stock quantity cannot be negative');
    }

    // Name translation rule: copy entered name if the other is empty
    let nameEn = data.nameEn || '';
    let namePa = data.namePa || '';
    let isAutoTranslated = false;

    if (!nameEn.trim() && namePa.trim()) {
      nameEn = namePa;
      isAutoTranslated = true;
    } else if (!namePa.trim() && nameEn.trim()) {
      namePa = nameEn;
      isAutoTranslated = true;
    }

    if (!nameEn.trim() && !namePa.trim()) {
      throw new Error('Product Name is required');
    }

    // Default category to General if empty
    const categoryName = data.category && data.category.trim() ? data.category.trim() : 'General';

    return prisma.$transaction(async (tx) => {
      // Validate business profile fields
      const shop = await tx.shop.findUnique({ where: { id: data.shopId } });
      if (!shop) throw new Error('Shop not found');
      
      const profile = getBusinessProfile(shop.businessType);
      for (const field of profile.fields.filter(f => f.required && f.visible)) {
        const val = (data as any)[field.name];
        if (val === undefined || val === null || val === '') {
          throw new Error(`${field.name.toUpperCase()} is required for business type: ${profile.displayName}`);
        }
      }

      // SKU Generation: shop-specific sequence starting with PRD-000001
      let finalSku = data.sku;
      if (!finalSku || !finalSku.trim()) {
        const lastProduct = await tx.product.findFirst({
          where: {
            shopId: data.shopId,
            sku: { startsWith: 'PRD-' },
          },
          orderBy: {
            sku: 'desc',
          },
        });
        
        let nextSeq = 1;
        if (lastProduct && lastProduct.sku) {
          const match = lastProduct.sku.match(/^PRD-(\d+)$/);
          if (match) {
            nextSeq = parseInt(match[1], 10) + 1;
          }
        }
        finalSku = `PRD-${nextSeq.toString().padStart(6, '0')}`;
      } else {
        // Verify unique SKU per shop
        const existingSku = await tx.product.findFirst({
          where: { shopId: data.shopId, sku: finalSku, isDeleted: false },
        });
        if (existingSku) {
          throw new Error(`SKU "${finalSku}" already exists in this shop`);
        }
      }

      // Check Barcode uniqueness if barcode is provided
      if (data.barcode) {
        const existingBarcode = await tx.product.findFirst({
          where: { shopId: data.shopId, barcode: data.barcode, isDeleted: false },
        });
        if (existingBarcode) {
          throw new Error(`Barcode "${data.barcode}" already exists in this shop`);
        }
      }

      // Resolve Category and Brand (auto-create and normalize)
      const category = await CategoryBrandRepository.findOrCreateCategory(tx, data.shopId, categoryName);
      const brand = data.brand
        ? await CategoryBrandRepository.findOrCreateBrand(tx, data.shopId, data.brand)
        : null;

      // Create product with 0 quantity initially to maintain ledger transactions
      const product = await tx.product.create({
        data: {
          sku: finalSku,
          barcode: data.barcode || null,
          nameEn,
          namePa,
          isAutoTranslated,
          categoryName: category?.name || null,
          categoryId: category?.id || null,
          brandId: brand?.id || null,
          purchasePrice: new Prisma.Decimal(data.purchasePrice.toString()),
          sellingPrice: new Prisma.Decimal(data.sellingPrice.toString()),
          currentQuantity: new Prisma.Decimal('0'), // Set 0 initially
          unit: data.unit || 'PCS',
          minStock: new Prisma.Decimal(data.minStock.toString()),
          reorderLevel: new Prisma.Decimal(data.minStock.toString()),
          supplierId: data.supplierId || null,
          shopId: data.shopId,

          // Optional attributes (Phase 9)
          manufacturer: data.manufacturer || null,
          modelNumber: data.modelNumber || null,
          batchNumber: data.batchNumber || null,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          manufacturingDate: data.manufacturingDate ? new Date(data.manufacturingDate) : null,
          warrantyMonths: data.warrantyMonths !== undefined ? Number(data.warrantyMonths) : null,
          serialNumber: data.serialNumber || null,
          imei: data.imei || null,
          color: data.color || null,
          size: data.size || null,
          variant: data.variant || null,
          hsnCode: data.hsnCode || null,
          gstRate: data.gstRate !== undefined ? new Prisma.Decimal(data.gstRate.toString()) : null,
        },
      });

      // If initial stock quantity > 0, create an OPENING InventoryTransaction and update the stock
      if (data.currentQuantity > 0) {
        const stockQty = new Prisma.Decimal(data.currentQuantity.toString());
        await tx.inventoryTransaction.create({
          data: {
            productId: product.id,
            type: TransactionType.OPENING, // Ledger entry type
            quantity: stockQty,
            previousQty: new Prisma.Decimal('0'),
            newQty: stockQty,
            price: new Prisma.Decimal(data.purchasePrice.toString()),
            note: 'Initial stock opening balance',
          },
        });

        // Update product quantity to match ledger
        await tx.product.update({
          where: { id: product.id },
          data: {
            currentQuantity: stockQty,
          },
        });

        product.currentQuantity = stockQty;
      }

      return product;
    });
  }

  static async updateProduct(
    id: string,
    data: Partial<{
      sku: string;
      barcode: string;
      nameEn: string;
      namePa: string;
      category: string;
      brand: string;
      purchasePrice: number;
      sellingPrice: number;
      unit: string;
      minStock: number;
      supplierId: string;

      // Optional attributes (Phase 9)
      manufacturer: string;
      modelNumber: string;
      batchNumber: string;
      expiryDate: Date | string;
      manufacturingDate: Date | string;
      warrantyMonths: number;
      serialNumber: string;
      imei: string;
      color: string;
      size: string;
      variant: string;
      hsnCode: string;
      gstRate: number;
    }>
  ) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.product.findUnique({
        where: { id },
      });
      if (!current || current.isDeleted) {
        throw new Error('Product not found');
      }

      // Validate business profile fields
      const shop = await tx.shop.findUnique({ where: { id: current.shopId } });
      if (!shop) throw new Error('Shop not found');
      
      const profile = getBusinessProfile(shop.businessType);
      for (const field of profile.fields.filter(f => f.required && f.visible)) {
        const key = field.name as keyof typeof data;
        const val = data[key] !== undefined ? data[key] : (current as any)[field.name];
        if (val === undefined || val === null || val === '') {
          throw new Error(`${field.name.toUpperCase()} is required for business type: ${profile.displayName}`);
        }
      }

      const updateData: Prisma.ProductUncheckedUpdateInput = {};

      if (data.sku !== undefined) {
        if (!data.sku.trim()) {
          throw new Error('SKU cannot be empty');
        }
        const existing = await tx.product.findFirst({
          where: { shopId: current.shopId, sku: data.sku, id: { not: id }, isDeleted: false },
        });
        if (existing) {
          throw new Error(`SKU "${data.sku}" already exists in this shop`);
        }
        updateData.sku = data.sku;
      }

      if (data.barcode !== undefined) {
        if (data.barcode) {
          const existing = await tx.product.findFirst({
            where: { shopId: current.shopId, barcode: data.barcode, id: { not: id }, isDeleted: false },
          });
          if (existing) {
            throw new Error(`Barcode "${data.barcode}" already exists in this shop`);
          }
        }
        updateData.barcode = data.barcode || null;
      }

      let nameEn = data.nameEn !== undefined ? data.nameEn : current.nameEn;
      let namePa = data.namePa !== undefined ? data.namePa : current.namePa;
      let isAutoTranslated = current.isAutoTranslated;

      if (data.nameEn !== undefined || data.namePa !== undefined) {
        if (!nameEn.trim() && namePa.trim()) {
          nameEn = namePa;
          isAutoTranslated = true;
        } else if (!namePa.trim() && nameEn.trim()) {
          namePa = nameEn;
          isAutoTranslated = true;
        } else {
          isAutoTranslated = false;
        }

        updateData.nameEn = nameEn;
        updateData.namePa = namePa;
        updateData.isAutoTranslated = isAutoTranslated;
      }

      if (data.unit !== undefined) updateData.unit = data.unit;

      if (data.purchasePrice !== undefined) {
        if (data.purchasePrice < 0) throw new Error('Purchase price cannot be negative');
        updateData.purchasePrice = new Prisma.Decimal(data.purchasePrice.toString());
      }

      if (data.sellingPrice !== undefined) {
        if (data.sellingPrice < 0) throw new Error('Selling price cannot be negative');
        updateData.sellingPrice = new Prisma.Decimal(data.sellingPrice.toString());
      }

      if (data.minStock !== undefined) {
        if (data.minStock < 0) throw new Error('Minimum stock alert cannot be negative');
        updateData.minStock = new Prisma.Decimal(data.minStock.toString());
        updateData.reorderLevel = new Prisma.Decimal(data.minStock.toString());
      }

      if (data.category !== undefined) {
        const categoryName = data.category && data.category.trim() ? data.category.trim() : 'General';
        const category = await CategoryBrandRepository.findOrCreateCategory(tx, current.shopId, categoryName);
        updateData.categoryId = category?.id || null;
        updateData.categoryName = category?.name || null;
      }

      if (data.brand !== undefined) {
        const brand = data.brand
          ? await CategoryBrandRepository.findOrCreateBrand(tx, current.shopId, data.brand)
          : null;
        updateData.brandId = brand?.id || null;
      }

      if (data.supplierId !== undefined) {
        updateData.supplierId = data.supplierId || null;
      }

      // Optional attributes (Phase 9)
      if (data.manufacturer !== undefined) updateData.manufacturer = data.manufacturer || null;
      if (data.modelNumber !== undefined) updateData.modelNumber = data.modelNumber || null;
      if (data.batchNumber !== undefined) updateData.batchNumber = data.batchNumber || null;
      if (data.expiryDate !== undefined) updateData.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
      if (data.manufacturingDate !== undefined) updateData.manufacturingDate = data.manufacturingDate ? new Date(data.manufacturingDate) : null;
      if (data.warrantyMonths !== undefined) updateData.warrantyMonths = data.warrantyMonths !== undefined ? Number(data.warrantyMonths) : null;
      if (data.serialNumber !== undefined) updateData.serialNumber = data.serialNumber || null;
      if (data.imei !== undefined) updateData.imei = data.imei || null;
      if (data.color !== undefined) updateData.color = data.color || null;
      if (data.size !== undefined) updateData.size = data.size || null;
      if (data.variant !== undefined) updateData.variant = data.variant || null;
      if (data.hsnCode !== undefined) updateData.hsnCode = data.hsnCode || null;
      if (data.gstRate !== undefined) updateData.gstRate = data.gstRate !== undefined ? new Prisma.Decimal(data.gstRate.toString()) : null;

      return tx.product.update({
        where: { id },
        data: updateData,
      });
    });
  }

  static async deleteProduct(id: string) {
    return ProductRepository.softDelete(id);
  }

  static async getCategories(shopId: string) {
    return ProductRepository.getCategories(shopId);
  }
}
