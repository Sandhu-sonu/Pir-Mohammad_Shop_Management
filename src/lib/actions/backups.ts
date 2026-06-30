'use server';

import { getCurrentUser } from './auth';
import { BackupService } from '../../db/services/BackupService';
import { BackupRepository } from '../../db/repositories/BackupRepository';
import { AuditLogService } from '../../db/services/AuditLogService';
import { revalidatePath } from 'next/cache';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Trigger manual backup creation
 */
export async function createBackupAction(notes?: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
    throw new Error('Permission denied: Only OWNER and MANAGER can create backups.');
  }

  try {
    const history = await BackupService.createBackup(user.shopId, user.userId, notes);

    await AuditLogService.log({
      userId: user.userId,
      action: 'Backup Created',
      module: 'Backup',
      entity: history.id,
      after: history,
    });

    revalidatePath('/settings');
    return { success: true, history: JSON.parse(JSON.stringify(history)) };
  } catch (err: any) {
    console.error('Action error creating backup:', err);
    return { success: false, error: err.message || 'Failed to create backup.' };
  }
}

/**
 * Downloads a backup payload string by filename
 */
export async function downloadBackupAction(filename: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
    throw new Error('Permission denied: Only OWNER and MANAGER can download backups.');
  }

  try {
    const backupDir = BackupService.getBackupDir();
    const filepath = path.join(backupDir, filename);

    // Secure path traversal block
    if (!filepath.startsWith(backupDir)) {
      throw new Error('Security Violation: Invalid file path.');
    }

    if (!fs.existsSync(filepath)) {
      throw new Error('Backup file not found.');
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    return { success: true, filename, content };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to download backup.' };
  }
}

/**
 * Preview backup details before restoring
 */
export async function previewBackupAction(jsonContent: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
    throw new Error('Permission denied.');
  }

  try {
    const preview = BackupService.validateAndPreviewBackup(user.shopId, jsonContent);
    return { success: true, preview };
  } catch (err: any) {
    return { success: false, error: err.message || 'Invalid backup payload.' };
  }
}

/**
 * Restores a database backup from uploaded JSON string
 */
export async function restoreBackupAction(jsonContent: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
    throw new Error('Permission denied: Only OWNER and MANAGER can restore backups.');
  }

  try {
    const result = await BackupService.restoreBackup(user.shopId, user.userId, jsonContent);

    await AuditLogService.log({
      userId: user.userId,
      action: 'Backup Restored',
      module: 'Backup',
      after: result.preview,
    });

    revalidatePath('/settings');
    revalidatePath('/dashboard');
    revalidatePath('/inventory');
    revalidatePath('/sales');
    revalidatePath('/customers');
    revalidatePath('/suppliers');
    revalidatePath('/purchases');
    revalidatePath('/expenses');

    return { success: true, preview: result.preview };
  } catch (err: any) {
    console.error('Action error restoring backup:', err);

    await AuditLogService.log({
      userId: user.userId,
      action: 'Restore Failed',
      module: 'Backup',
      after: { error: err.message || 'Database rollback executed.' },
    });

    return { success: false, error: err.message || 'Failed to restore backup.' };
  }
}

/**
 * Fetches backup history
 */
export async function getBackupHistoryAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
    throw new Error('Permission denied.');
  }

  const history = await BackupRepository.getBackupHistory(user.shopId);
  return JSON.parse(JSON.stringify(history));
}

/**
 * Fetches restore logs
 */
export async function getRestoreLogsAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
    throw new Error('Permission denied.');
  }

  const logs = await BackupRepository.getRestoreLogs(user.shopId);
  return JSON.parse(JSON.stringify(logs));
}

/**
 * Log session recovery performed
 */
export async function logSessionRecoveryAction(details: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  await AuditLogService.log({
    userId: user.userId,
    action: 'Session Recovery',
    module: 'System',
    after: { details },
  });

  return { success: true };
}
