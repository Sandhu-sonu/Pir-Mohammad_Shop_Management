'use server';

import { getCurrentUser } from './auth';
import { ImportService } from '../../db/services/ImportService';
import { AuditLogService } from '../../db/services/AuditLogService';
import { revalidatePath } from 'next/cache';

export async function importProductsAction(rows: any[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
    throw new Error('Permission denied: Only OWNER and MANAGER can import products.');
  }

  try {
    const summary = await ImportService.importProducts(user.shopId, rows);

    await AuditLogService.log({
      userId: user.userId,
      action: 'Import Completed',
      module: 'Import',
      after: {
        imported: summary.imported,
        updated: summary.updated,
        failed: summary.failed,
        message: 'Products imported'
      },
    });

    revalidatePath('/inventory');
    revalidatePath('/dashboard');
    return { success: true, summary };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to import products.' };
  }
}

export async function importCustomersAction(rows: any[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
    throw new Error('Permission denied: Only OWNER and MANAGER can import customers.');
  }

  try {
    const summary = await ImportService.importCustomers(user.shopId, rows);

    await AuditLogService.log({
      userId: user.userId,
      action: 'Import Completed',
      module: 'Import',
      after: {
        imported: summary.imported,
        updated: summary.updated,
        failed: summary.failed,
        message: 'Customers imported'
      },
    });

    revalidatePath('/customers');
    revalidatePath('/dashboard');
    return { success: true, summary };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to import customers.' };
  }
}

export async function importSuppliersAction(rows: any[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
    throw new Error('Permission denied: Only OWNER and MANAGER can import suppliers.');
  }

  try {
    const summary = await ImportService.importSuppliers(user.shopId, rows);

    await AuditLogService.log({
      userId: user.userId,
      action: 'Import Completed',
      module: 'Import',
      after: {
        imported: summary.imported,
        updated: summary.updated,
        failed: summary.failed,
        message: 'Suppliers imported'
      },
    });

    revalidatePath('/suppliers');
    revalidatePath('/dashboard');
    return { success: true, summary };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to import suppliers.' };
  }
}
