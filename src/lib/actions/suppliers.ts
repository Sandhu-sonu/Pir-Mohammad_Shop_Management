'use server';

import { SupplierRepository } from '../../db/repositories/SupplierRepository';
import { getCurrentUser } from './auth';
import { revalidatePath } from 'next/cache';

export async function getSuppliersAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const suppliers = await SupplierRepository.findAll(user.shopId);
  return JSON.parse(JSON.stringify(suppliers));
}

export async function createSupplierAction(data: { name: string; mobile?: string; gst?: string; currentBalance: number }) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const supplier = await SupplierRepository.create({
    ...data,
    shopId: user.shopId,
  });

  revalidatePath('/suppliers');
  revalidatePath('/purchases');
  return JSON.parse(JSON.stringify(supplier));
}

export async function paySupplierAction(supplierId: string, amount: number, note?: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const ledgerEntry = await SupplierRepository.paySupplier(user.shopId, supplierId, amount, note);

  revalidatePath('/suppliers');
  revalidatePath('/dashboard');
  return JSON.parse(JSON.stringify(ledgerEntry));
}

export async function getSupplierLedgerAction(supplierId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const ledger = await SupplierRepository.getLedger(supplierId);
  return JSON.parse(JSON.stringify(ledger));
}
