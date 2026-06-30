'use server';

import { SalesService } from '../../db/services/SalesService';
import { getCurrentUser } from './auth';
import { PaymentMethod } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '../permissions';
import { handleActionError } from '../errors';

export interface CreateSaleActionInput {
  customerId?: string;
  items: {
    productId: string;
    quantity: number;
    sellingPrice: number;
  }[];
  discount: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
}

export async function createSaleAction(data: CreateSaleActionInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  requirePermission(user.role, 'sales.write');

  try {
    const result = await SalesService.createSale({
      ...data,
      shopId: user.shopId,
      userId: user.userId,
    });

    revalidatePath('/sales');
    revalidatePath('/inventory');
    revalidatePath('/customers');
    revalidatePath('/dashboard');
    return { success: true, sale: JSON.parse(JSON.stringify(result)) };
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function getSaleAction(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  requirePermission(user.role, 'sales.read');

  try {
    const result = await SalesService.getSale(id);
    return JSON.parse(JSON.stringify(result));
  } catch (err: any) {
    return null;
  }
}

export async function listSalesAction(page = 1, limit = 10) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  requirePermission(user.role, 'sales.read');

  const result = await SalesService.listSales(user.shopId, page, limit);
  return JSON.parse(JSON.stringify(result));
}

export async function reverseSaleAction(saleId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  requirePermission(user.role, 'sales.reverse');

  try {
    const result = await SalesService.reverseSale(saleId, user.userId);

    revalidatePath('/sales');
    revalidatePath('/inventory');
    revalidatePath('/customers');
    revalidatePath('/dashboard');
    return { success: true, sale: JSON.parse(JSON.stringify(result)) };
  } catch (err: any) {
    return handleActionError(err);
  }
}
