'use server';

import { DailyClosingRepository } from '../../db/repositories/DailyClosingRepository';
import { getCurrentUser } from './auth';
import { revalidatePath } from 'next/cache';
import { AuditLogService } from '../../db/services/AuditLogService';
import { prisma } from '../../db/prisma';
import { requirePermission } from '../permissions';
import { handleActionError } from '../errors';

export async function getClosingForDateAction(dateString: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  requirePermission(user.role, 'dailyClosing.read');

  const closing = await DailyClosingRepository.getClosingForDate(user.shopId, new Date(dateString));
  return closing ? JSON.parse(JSON.stringify(closing)) : null;
}

export async function calculateClosingMetricsAction(dateString: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  requirePermission(user.role, 'dailyClosing.read');

  const metrics = await DailyClosingRepository.calculateClosingMetrics(user.shopId, new Date(dateString));
  return metrics;
}

export async function saveClosingAction(data: {
  dateString: string;
  openingCash: number;
  closingCash: number;
  withdrawals?: number;
  notes?: string;
  staffSignature?: string;
  staffUserId?: string;
  ownerSignature?: string;
  ownerUserId?: string;
}) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    requirePermission(user.role, 'dailyClosing.write');

    const closing = await DailyClosingRepository.saveClosing({
      shopId: user.shopId,
      date: new Date(data.dateString),
      openingCash: data.openingCash,
      closingCash: data.closingCash,
      withdrawals: data.withdrawals || 0,
      notes: data.notes,
      staffSignature: data.staffSignature,
      staffUserId: data.staffUserId,
      ownerSignature: data.ownerSignature,
      ownerUserId: data.ownerUserId,
      userId: user.userId,
    });

    await AuditLogService.log({
      userId: user.userId,
      action: 'Lock Daily Closing',
      module: 'Closing',
      entity: closing.id,
      after: closing,
    });

    revalidatePath('/dashboard/closing');
    revalidatePath('/dashboard');
    return { success: true, closing: JSON.parse(JSON.stringify(closing)) };
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function reverseClosingAction(id: string, reason: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    requirePermission(user.role, 'dailyClosing.reverse');

    const oldClosing = await prisma.dailyClosing.findUnique({
      where: { id },
    });
    if (!oldClosing) throw new Error('Daily closing record not found');
    if (oldClosing.isReversed) throw new Error('Daily closing is already reversed');

    const result = await DailyClosingRepository.reverseClosing(id, user.userId, reason);

    await AuditLogService.log({
      userId: user.userId,
      action: 'Reverse Daily Closing',
      module: 'Closing',
      entity: id,
      before: oldClosing,
      after: result,
    });

    revalidatePath('/dashboard/closing');
    revalidatePath('/dashboard');
    return { success: true, closing: JSON.parse(JSON.stringify(result)) };
  } catch (err: any) {
    return handleActionError(err);
  }
}
