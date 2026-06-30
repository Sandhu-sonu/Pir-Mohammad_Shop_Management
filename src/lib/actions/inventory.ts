'use server';

import { ProductService } from '../../db/services/ProductService';
import { ProductImportService, ImportMode } from '../../db/services/ProductImportService';
import { InventoryRepository } from '../../db/repositories/InventoryRepository';
import { getCurrentUser } from './auth';
import { revalidatePath } from 'next/cache';
import { prisma } from '../../db/prisma';
import { TransactionType } from '@prisma/client';
import { requirePermission } from '../permissions';
import { handleActionError } from '../errors';

export async function getProductsAction(filters: {
  search?: string;
  category?: string;
  lowStockOnly?: boolean;
  page?: number;
  limit?: number;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  requirePermission(user.role, 'products.read');

  return ProductService.listProducts({
    ...filters,
    shopId: user.shopId,
  });
}

export async function addProductAction(data: {
  sku?: string;
  barcode?: string;
  nameEn?: string;
  namePa?: string;
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
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  requirePermission(user.role, 'products.create');

  try {
    const result = await ProductService.addProduct({
      ...data,
      nameEn: data.nameEn || '',
      namePa: data.namePa || '',
      shopId: user.shopId,
    });

    revalidatePath('/inventory');
    revalidatePath('/dashboard');
    return { success: true, product: JSON.parse(JSON.stringify(result)) };
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function updateProductAction(
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
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  requirePermission(user.role, 'products.update');

  try {
    const result = await ProductService.updateProduct(id, data);

    revalidatePath('/inventory');
    return { success: true, product: JSON.parse(JSON.stringify(result)) };
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function deleteProductAction(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  requirePermission(user.role, 'products.delete');

  try {
    await ProductService.deleteProduct(id);

    revalidatePath('/inventory');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function getCategoriesAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  requirePermission(user.role, 'products.read');

  return ProductService.getCategories(user.shopId);
}

export async function getProductStockHistoryAction(productId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  requirePermission(user.role, 'inventory.read');

  const transactions = await InventoryRepository.getTransactionHistory(productId);
  return JSON.parse(JSON.stringify(transactions));
}

export async function importCsvAction(csvContent: string, filename: string = 'import.csv', mode: ImportMode = 'UPSERT') {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  requirePermission(user.role, 'products.create');

  try {
    const result = await ProductImportService.importCSV(user.shopId, filename, csvContent, mode);

    revalidatePath('/inventory');
    revalidatePath('/dashboard');
    return { success: true, ...JSON.parse(JSON.stringify(result)) };
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function adjustStockAction(data: {
  productId: string;
  quantity: number;
  type: TransactionType;
  price: number;
  note?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  requirePermission(user.role, 'inventory.write');

  try {
    const result = await prisma.$transaction(async (tx) => {
      return InventoryRepository.adjustStock(tx, {
        ...data,
        userId: user.userId,
      });
    });

    revalidatePath('/inventory');
    revalidatePath('/dashboard');
    return { success: true, ...JSON.parse(JSON.stringify(result)) };
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function dismissAlertAction(productId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  requirePermission(user.role, 'inventory.write');

  try {
    const alert = await prisma.stockAlert.findFirst({
      where: {
        productId,
        status: 'ACTIVE',
      },
    });

    if (alert) {
      await prisma.stockAlert.update({
        where: { id: alert.id },
        data: {
          status: 'DISMISSED',
          isDismissed: true,
        },
      });
    }

    revalidatePath('/inventory');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return handleActionError(err);
  }
}
