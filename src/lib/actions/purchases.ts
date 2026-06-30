'use server';

import { PurchaseRepository } from '../../db/repositories/PurchaseRepository';
import { PurchaseReturnRepository } from '../../db/repositories/PurchaseReturnRepository';
import { getCurrentUser } from './auth';
import { PurchaseStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '../permissions';
import { handleActionError } from '../errors';

export async function getPurchasesAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  requirePermission(user.role, 'purchases.read');

  const purchases = await PurchaseRepository.findAll(user.shopId);
  return JSON.parse(JSON.stringify(purchases));
}

export async function getPurchaseAction(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  requirePermission(user.role, 'purchases.read');

  const purchase = await PurchaseRepository.findById(id);
  return JSON.parse(JSON.stringify(purchase));
}

export async function createPurchaseAction(data: {
  supplierId: string;
  items: { productId: string; quantity: number; purchasePrice: number }[];
  invoiceNumber?: string;
  note?: string;
  paidAmount: number;
  status: PurchaseStatus;
}) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    requirePermission(user.role, 'purchases.write');

    const purchase = await PurchaseRepository.create({
      shopId: user.shopId,
      supplierId: data.supplierId,
      items: data.items,
      invoiceNumber: data.invoiceNumber,
      note: data.note,
      paidAmount: data.paidAmount,
      status: data.status,
    });

    revalidatePath('/purchases');
    revalidatePath('/suppliers');
    revalidatePath('/inventory');
    revalidatePath('/dashboard');
    return JSON.parse(JSON.stringify(purchase));
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function transitionPurchaseStatusAction(purchaseId: string, status: PurchaseStatus, paidAmount?: number) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    requirePermission(user.role, 'purchases.write');

    const purchase = await PurchaseRepository.transitionStatus(purchaseId, status, paidAmount);

    revalidatePath('/purchases');
    revalidatePath('/suppliers');
    revalidatePath('/inventory');
    revalidatePath('/dashboard');
    return JSON.parse(JSON.stringify(purchase));
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function createPurchaseReturnAction(data: {
  purchaseId: string;
  productId: string;
  componentType?: never; // Type safety compliance
  quantity: number;
  reason?: string;
}) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    requirePermission(user.role, 'purchases.write');

    const result = await PurchaseReturnRepository.createReturn(data);

    revalidatePath('/purchases');
    revalidatePath('/suppliers');
    revalidatePath('/inventory');
    revalidatePath('/dashboard');
    return JSON.parse(JSON.stringify(result));
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function getPurchaseReturnsAction(purchaseId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  requirePermission(user.role, 'purchases.read');

  const returns = await PurchaseReturnRepository.getReturnsForPurchase(purchaseId);
  return JSON.parse(JSON.stringify(returns));
}
