'use server';

import { getCurrentUser } from './auth';
import { prisma } from '../../db/prisma';
import { BackupRepository } from '../../db/repositories/BackupRepository';
import { BackupService } from '../../db/services/BackupService';
import * as fs from 'fs';
import * as path from 'path';

export async function getSystemHealthAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  // Enforce role permission: Only OWNER and MANAGER can view system health
  if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
    throw new Error('Permission denied.');
  }

  const shopId = user.shopId;

  try {
    // 1. Database Connection & Size
    let dbSize = 'Unknown';
    let dbStatus = 'CONNECTED';
    try {
      const sizeResult: any[] = await prisma.$queryRawUnsafe(
        `SELECT pg_size_pretty(pg_database_size(current_database())) as size;`
      );
      dbSize = sizeResult[0]?.size || 'Unknown';
    } catch (err) {
      console.error('Failed to query database size:', err);
      dbStatus = 'DEGRADED';
    }

    // 2. Query backup statistics
    const latestBackup = await BackupRepository.getLatestBackup(shopId);
    const latestRestore = await BackupRepository.getLatestRestore(shopId);
    const backupCount = await BackupRepository.getBackupCount(shopId);

    // 3. Query last Daily Closing
    const latestClosing = await prisma.dailyClosing.findFirst({
      where: { shopId, isReversed: false },
      orderBy: { date: 'desc' },
    });

    // 4. Calculate local backup directory size
    let backupFolderSize = 0;
    let backupFileCount = 0;
    try {
      const backupDir = BackupService.getBackupDir();
      const files = fs.readdirSync(backupDir);
      backupFileCount = files.length;
      for (const file of files) {
        const stats = fs.statSync(path.join(backupDir, file));
        backupFolderSize += stats.size;
      }
    } catch (err) {
      console.error('Failed to calculate backup folder size:', err);
    }

    // Format folder size to human readable
    const folderSizeFormatted = (backupFolderSize / (1024 * 1024)).toFixed(2) + ' MB';

    return {
      success: true,
      health: {
        appVersion: '1.0.0',
        dbStatus,
        dbSize,
        lastBackup: latestBackup ? latestBackup.createdAt.toISOString() : null,
        lastBackupStatus: latestBackup ? latestBackup.status : 'NONE',
        lastRestore: latestRestore ? latestRestore.createdAt.toISOString() : null,
        lastRestoreStatus: latestRestore ? latestRestore.status : 'NONE',
        lastClosing: latestClosing ? latestClosing.date.toISOString() : null,
        backupCount,
        backupFolderSize: folderSizeFormatted,
        backupFileCount,
      },
    };
  } catch (err: any) {
    console.error('Failed to get system health:', err);
    return {
      success: false,
      error: err.message || 'Failed to retrieve system health diagnostics.',
    };
  }
}
