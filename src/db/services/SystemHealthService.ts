import * as os from 'os';
import { prisma } from '../prisma';

export interface SystemHealthMetrics {
  appVersion: string;
  dbVersion: string;
  prismaVersion: string;
  nodeVersion: string;
  osPlatform: string;
  serverTime: string;
  timezone: string;
  uptime: number; // in seconds
  dbSize: string;
  lastBackupTime: string;
  activeSessions: number;
}

export interface SystemHealthProvider {
  getMetrics(): Promise<SystemHealthMetrics>;
}

export class LocalHealthProvider implements SystemHealthProvider {
  async getMetrics(): Promise<SystemHealthMetrics> {
    // 1. Get dbVersion & dbSize from PostgreSQL
    let dbVersion = 'PostgreSQL';
    let dbSize = 'Unknown';
    try {
      const versionResult: any[] = await prisma.$queryRawUnsafe("SELECT version()");
      if (versionResult && versionResult[0]) {
        dbVersion = versionResult[0].version.split(',')[0];
      }

      const sizeResult: any[] = await prisma.$queryRawUnsafe(
        "SELECT pg_size_pretty(pg_database_size(current_database())) as size"
      );
      if (sizeResult && sizeResult[0]) {
        dbSize = sizeResult[0].size;
      }
    } catch (err) {
      console.error('Failed to get database stats:', err);
    }

    // 2. Fetch last backup timestamp from AuditLog
    let lastBackupTime = 'No backup logged';
    try {
      const lastBackupLog = await prisma.auditLog.findFirst({
        where: { action: 'Backup Created' },
        orderBy: { createdAt: 'desc' }
      });
      if (lastBackupLog) {
        lastBackupTime = new Date(lastBackupLog.createdAt).toLocaleString();
      }
    } catch {}

    // 3. Count active sessions (users status ACTIVE)
    let activeSessions = 0;
    try {
      activeSessions = await prisma.user.count({
        where: { status: 'ACTIVE' }
      });
    } catch {}

    // 4. Resolve node, prisma, app details
    const appVersion = '1.0.0'; // Or read package.json
    const prismaVersion = '7.8.0';
    const nodeVersion = process.version;
    const osPlatform = `${os.type()} ${os.release()} (${os.arch()})`;
    const serverTime = new Date().toLocaleString();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const uptime = Math.floor(process.uptime());

    return {
      appVersion,
      dbVersion,
      prismaVersion,
      nodeVersion,
      osPlatform,
      serverTime,
      timezone,
      uptime,
      dbSize,
      lastBackupTime,
      activeSessions
    };
  }
}

export class SystemHealthService {
  private static provider: SystemHealthProvider = new LocalHealthProvider();

  static setProvider(customProvider: SystemHealthProvider) {
    this.provider = customProvider;
  }

  static async getDiagnostics(): Promise<SystemHealthMetrics> {
    return this.provider.getMetrics();
  }
}
