'use server';

import { SupplierRepository } from '../../db/repositories/SupplierRepository';
import { getCurrentUser } from './auth';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '../permissions';
import { handleActionError } from '../errors';

export async function getSuppliersAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  requirePermission(user.role, 'suppliers.read');

  const suppliers = await SupplierRepository.findAll(user.shopId);
  return JSON.parse(JSON.stringify(suppliers));
}

export async function createSupplierAction(data: { name: string; mobile?: string; gst?: string; currentBalance: number }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    requirePermission(user.role, 'suppliers.write');

    const supplier = await SupplierRepository.create({
      ...data,
      shopId: user.shopId,
    });

    revalidatePath('/suppliers');
    revalidatePath('/purchases');
    return JSON.parse(JSON.stringify(supplier));
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function paySupplierAction(supplierId: string, amount: number, note?: string, paymentMethod: any = 'CASH') {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    requirePermission(user.role, 'suppliers.write');

    const ledgerEntry = await SupplierRepository.paySupplier(user.shopId, supplierId, amount, note, paymentMethod);

    revalidatePath('/suppliers');
    revalidatePath('/dashboard');
    return JSON.parse(JSON.stringify(ledgerEntry));
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function getSupplierLedgerAction(supplierId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  requirePermission(user.role, 'suppliers.read');

  const ledger = await SupplierRepository.getLedger(supplierId);
  return JSON.parse(JSON.stringify(ledger));
}
