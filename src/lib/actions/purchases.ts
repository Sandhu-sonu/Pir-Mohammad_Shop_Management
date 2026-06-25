'use server';

import { PurchaseRepository, CreatePurchaseInput } from '../../db/repositories/PurchaseRepository';
import { PurchaseReturnRepository, CreatePurchaseReturnInput } from '../../db/repositories/PurchaseReturnRepository';
import { getCurrentUser } from './auth';
import { PurchaseStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getPurchasesAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const purchases = await PurchaseRepository.findAll(user.shopId);
  return JSON.parse(JSON.stringify(purchases));
}

export async function getPurchaseAction(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

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
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

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
}

export async function transitionPurchaseStatusAction(purchaseId: string, status: PurchaseStatus, paidAmount?: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const purchase = await PurchaseRepository.transitionStatus(purchaseId, status, paidAmount);

  revalidatePath('/purchases');
  revalidatePath('/suppliers');
  revalidatePath('/inventory');
  revalidatePath('/dashboard');
  return JSON.parse(JSON.stringify(purchase));
}

export async function createPurchaseReturnAction(data: {
  purchaseId: string;
  productId: string;
  quantity: number;
  reason?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const result = await PurchaseReturnRepository.createReturn(data);

  revalidatePath('/purchases');
  revalidatePath('/suppliers');
  revalidatePath('/inventory');
  revalidatePath('/dashboard');
  return JSON.parse(JSON.stringify(result));
}

export async function getPurchaseReturnsAction(purchaseId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const returns = await PurchaseReturnRepository.getReturnsForPurchase(purchaseId);
  return JSON.parse(JSON.stringify(returns));
}
