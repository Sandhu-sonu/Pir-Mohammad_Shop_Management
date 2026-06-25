'use server';

import { BarcodeRepository } from '../../db/repositories/BarcodeRepository';
import { getCurrentUser } from './auth';

export async function lookupBarcodeAction(barcode: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const product = await BarcodeRepository.lookupBarcode(user.shopId, barcode, user.userId);
  
  if (!product) return null;
  return JSON.parse(JSON.stringify(product));
}

export async function deactivateBarcodeSessionAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  await BarcodeRepository.deactivateActiveSession(user.shopId, user.userId);
  return { success: true };
}

export async function getBarcodeLogsAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const session = await BarcodeRepository.getOrCreateActiveSession(user.shopId, user.userId);
  const logs = await BarcodeRepository.getSessionLogs(session.id);
  return JSON.parse(JSON.stringify(logs));
}
