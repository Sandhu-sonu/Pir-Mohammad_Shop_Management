'use server';

import { DailyClosingRepository } from '../../db/repositories/DailyClosingRepository';
import { getCurrentUser } from './auth';
import { revalidatePath } from 'next/cache';

export async function getClosingForDateAction(dateString: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const closing = await DailyClosingRepository.getClosingForDate(user.shopId, new Date(dateString));
  return closing ? JSON.parse(JSON.stringify(closing)) : null;
}

export async function calculateClosingMetricsAction(dateString: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const metrics = await DailyClosingRepository.calculateClosingMetrics(user.shopId, new Date(dateString));
  return metrics;
}

export async function saveClosingAction(data: {
  dateString: string;
  openingCash: number;
  closingCash: number;
  notes?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const closing = await DailyClosingRepository.saveClosing({
    shopId: user.shopId,
    date: new Date(data.dateString),
    openingCash: data.openingCash,
    closingCash: data.closingCash,
    notes: data.notes,
  });

  revalidatePath('/dashboard');
  return { success: true, closing: JSON.parse(JSON.stringify(closing)) };
}
