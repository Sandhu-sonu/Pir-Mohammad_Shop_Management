'use server';

import { ProfitService } from '../../db/services/ProfitService';
import { getCurrentUser } from './auth';

export async function getProfitReportAction(startDate: string, endDate: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  // Strict role check: Only Owner and Manager can access financial profit metrics
  if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
    throw new Error('Permission denied');
  }

  const report = await ProfitService.calculateProfit(
    user.shopId,
    new Date(startDate),
    new Date(endDate)
  );

  return report;
}
