import { prisma } from '../prisma';

export class BackupRepository {
  static async createBackupHistory(data: {
    shopId: string;
    backupType: string;
    backupVersion: string;
    schemaVersion: string;
    appVersion: string;
    filename: string;
    fileSize: number;
    status: string;
    duration: number;
    createdById?: string;
  }) {
    return prisma.backupHistory.create({
      data: {
        shopId: data.shopId,
        backupType: data.backupType,
        backupVersion: data.backupVersion,
        schemaVersion: data.schemaVersion,
        appVersion: data.appVersion,
        filename: data.filename,
        fileSize: data.fileSize,
        status: data.status,
        duration: data.duration,
        createdById: data.createdById || null,
      },
    });
  }

  static async getBackupHistory(shopId: string) {
    return prisma.backupHistory.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { name: true },
        },
      },
    });
  }

  static async createRestoreLog(data: {
    shopId: string;
    backupHistoryId?: string;
    status: string;
    error?: string;
    restoredById?: string;
  }) {
    return prisma.restoreLog.create({
      data: {
        shopId: data.shopId,
        backupHistoryId: data.backupHistoryId || null,
        status: data.status,
        error: data.error || null,
        restoredById: data.restoredById || null,
      },
    });
  }

  static async getRestoreLogs(shopId: string) {
    return prisma.restoreLog.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      include: {
        restoredBy: {
          select: { name: true },
        },
      },
    });
  }

  static async createExportHistory(data: {
    shopId: string;
    module: string;
    format: string;
    filename: string;
    fileSize?: number;
    status: string;
    progress?: number;
    createdById?: string;
  }) {
    return prisma.exportHistory.create({
      data: {
        shopId: data.shopId,
        module: data.module,
        format: data.format,
        filename: data.filename,
        fileSize: data.fileSize || null,
        status: data.status,
        progress: data.progress ?? 0,
        createdById: data.createdById || null,
      },
    });
  }

  static async updateExportProgress(
    id: string,
    progress: number,
    status: string,
    fileSize?: number
  ) {
    return prisma.exportHistory.update({
      where: { id },
      data: {
        progress,
        status,
        fileSize: fileSize !== undefined ? fileSize : undefined,
      },
    });
  }

  static async getExportHistory(shopId: string) {
    return prisma.exportHistory.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { name: true },
        },
      },
    });
  }

  static async getBackupCount(shopId: string) {
    return prisma.backupHistory.count({
      where: { shopId, status: 'SUCCESS' },
    });
  }

  static async getLatestBackup(shopId: string) {
    return prisma.backupHistory.findFirst({
      where: { shopId, status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getLatestRestore(shopId: string) {
    return prisma.restoreLog.findFirst({
      where: { shopId, status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Fetches backups to prune (outside the latest 30 successful backups)
   */
  static async getBackupsToPrune(shopId: string, keepCount = 30) {
    const activeBackups = await prisma.backupHistory.findMany({
      where: { shopId, status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
      skip: keepCount,
    });
    return activeBackups;
  }

  static async deleteBackupHistoryRecords(ids: string[]) {
    if (ids.length === 0) return;
    return prisma.backupHistory.deleteMany({
      where: {
        id: { in: ids },
      },
    });
  }
}
