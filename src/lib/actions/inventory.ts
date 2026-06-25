'use server';

import { ProductService } from '../../db/services/ProductService';
import { ProductImportService, ImportMode } from '../../db/services/ProductImportService';
import { InventoryRepository } from '../../db/repositories/InventoryRepository';
import { getCurrentUser } from './auth';
import { revalidatePath } from 'next/cache';
import { prisma } from '../../db/prisma';
import { TransactionType } from '@prisma/client';

export async function getProductsAction(filters: {
  search?: string;
  category?: string;
  lowStockOnly?: boolean;
  page?: number;
  limit?: number;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

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
  purchasePrice: number;
  sellingPrice: number;
  currentQuantity: number;
  unit: string;
  minStock: number;
  supplierId?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const result = await ProductService.addProduct({
    sku: data.sku,
    barcode: data.barcode,
    nameEn: data.nameEn || '',
    namePa: data.namePa || '',
    category: data.category,
    purchasePrice: data.purchasePrice,
    sellingPrice: data.sellingPrice,
    currentQuantity: data.currentQuantity,
    unit: data.unit,
    minStock: data.minStock,
    supplierId: data.supplierId,
    shopId: user.shopId,
  });

  revalidatePath('/inventory');
  revalidatePath('/dashboard');
  return { success: true, product: JSON.parse(JSON.stringify(result)) };
}

export async function updateProductAction(
  id: string,
  data: Partial<{
    sku: string;
    barcode: string;
    nameEn: string;
    namePa: string;
    category: string;
    purchasePrice: number;
    sellingPrice: number;
    unit: string;
    minStock: number;
    supplierId: string;
  }>
) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const result = await ProductService.updateProduct(id, data);

  revalidatePath('/inventory');
  return { success: true, product: JSON.parse(JSON.stringify(result)) };
}

export async function deleteProductAction(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  await ProductService.deleteProduct(id);

  revalidatePath('/inventory');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function getCategoriesAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  return ProductService.getCategories(user.shopId);
}

export async function getProductStockHistoryAction(productId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const transactions = await InventoryRepository.getTransactionHistory(productId);
  return JSON.parse(JSON.stringify(transactions));
}

export async function importCsvAction(csvContent: string, filename: string = 'import.csv', mode: ImportMode = 'UPSERT') {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const result = await ProductImportService.importCSV(user.shopId, filename, csvContent, mode);

  revalidatePath('/inventory');
  revalidatePath('/dashboard');
  return JSON.parse(JSON.stringify(result));
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

  const result = await prisma.$transaction(async (tx) => {
    return InventoryRepository.adjustStock(tx, {
      ...data,
      userId: user.userId,
    });
  });

  revalidatePath('/inventory');
  revalidatePath('/dashboard');
  return JSON.parse(JSON.stringify(result));
}

export async function dismissAlertAction(productId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

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
}
