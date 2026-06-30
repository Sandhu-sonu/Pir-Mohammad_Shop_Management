import { prisma } from '../prisma';
import { headers } from 'next/headers';

export class AuditLogService {
  /**
   * Creates an audit log entry in the database.
   * Auto-extracts IP and User-Agent headers if called inside a request context.
   */
  static async log(data: {
    userId: string;
    action: string;
    module: string;
    entity?: string;
    before?: any;
    after?: any;
  }) {
    let device: string | null = null;
    let ip: string | null = null;

    try {
      const headerList = await headers();
      device = headerList.get('user-agent');
      ip = headerList.get('x-forwarded-for') || headerList.get('x-real-ip');
    } catch {
      // Catch error when called outside request contexts (e.g. tests, seeds)
    }

    const beforeStr = data.before ? JSON.stringify(data.before) : null;
    const afterStr = data.after ? JSON.stringify(data.after) : null;

    return prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        module: data.module,
        entity: data.entity || null,
        before: beforeStr,
        after: afterStr,
        device,
        ip,
      },
    });
  }
}
