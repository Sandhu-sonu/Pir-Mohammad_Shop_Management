'use server';

import { getCurrentUser } from './auth';
import { ExportService } from '../../db/services/ExportService';
import { BackupRepository } from '../../db/repositories/BackupRepository';
import { AuditLogService } from '../../db/services/AuditLogService';
import { revalidatePath } from 'next/cache';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Triggers a new export task
 */
export async function triggerExportAction(module: string, format: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  // Enforce role permission: Only OWNER and MANAGER can export master datasets
  if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
    throw new Error('Permission denied: Only OWNER and MANAGER can trigger exports.');
  }

  try {
    const result = await ExportService.triggerExport(user.shopId, user.userId, module, format);

    await AuditLogService.log({
      userId: user.userId,
      action: 'Export Completed',
      module: 'Export',
      after: {
        module,
        format,
        result
      },
    });

    revalidatePath('/settings');
    return { success: true, ...result };
  } catch (err: any) {
    console.error('Action error triggering export:', err);
    return { success: false, error: err.message || 'Failed to trigger export.' };
  }
}

/**
 * Fetches the export history logs
 */
export async function getExportHistoryAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  // Enforce role permission: Only OWNER and MANAGER can view export history
  if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
    throw new Error('Permission denied.');
  }

  const history = await BackupRepository.getExportHistory(user.shopId);
  return JSON.parse(JSON.stringify(history));
}

/**
 * Securely transfers an export file's payload (base64 for binary excel)
 */
export async function downloadExportFileAction(filename: string, format: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
    throw new Error('Permission denied.');
  }

  try {
    const exportDir = ExportService.getExportDir();
    const filepath = path.join(exportDir, filename);

    // Secure path traversal block
    if (!filepath.startsWith(exportDir)) {
      throw new Error('Security Violation: Invalid file path.');
    }

    if (!fs.existsSync(filepath)) {
      throw new Error('Export file not found.');
    }

    const contentBuffer = fs.readFileSync(filepath);
    const base64Content = contentBuffer.toString('base64');

    return {
      success: true,
      filename,
      content: base64Content,
      mimeType:
        format.toUpperCase() === 'EXCEL'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : format.toUpperCase() === 'JSON'
          ? 'application/json'
          : 'text/csv',
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to download export file.' };
  }
}
