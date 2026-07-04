import { prisma } from '../prisma';
import { NotificationStatus } from '@prisma/client';

export class NotificationService {
  /**
   * Appends a new persistent notification to a shop's registry
   */
  static async createNotification(
    shopId: string,
    title: string,
    message: string,
    type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS'
  ) {
    try {
      return await prisma.notification.create({
        data: {
          shopId,
          title,
          message,
          type,
          status: NotificationStatus.UNREAD
        }
      });
    } catch (err) {
      console.error('Failed to create notification:', err);
      return null;
    }
  }

  /**
   * Retrieves all notifications for a shop, filtered by status
   */
  static async getNotifications(shopId: string, status?: NotificationStatus) {
    try {
      return await prisma.notification.findMany({
        where: {
          shopId,
          status: status || undefined
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch {
      return [];
    }
  }

  /**
   * Updates status of a notification (e.g. READ, ARCHIVED)
   */
  static async updateStatus(notificationId: string, status: NotificationStatus) {
    try {
      return await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status,
          readAt: status === NotificationStatus.READ ? new Date() : undefined
        }
      });
    } catch (err) {
      console.error('Failed to update notification status:', err);
      return null;
    }
  }

  /**
   * Deletes all ARCHIVED notifications to keep table sizes pruned
   */
  static async pruneNotifications(shopId: string) {
    try {
      return await prisma.notification.deleteMany({
        where: {
          shopId,
          status: NotificationStatus.ARCHIVED
        }
      });
    } catch {
      return null;
    }
  }
}
