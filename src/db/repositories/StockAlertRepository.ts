import { prisma } from '../prisma';
import { StockAlertStatus } from '@prisma/client';

export class StockAlertRepository {
  static async getActiveAlerts(shopId: string) {
    return prisma.stockAlert.findMany({
      where: {
        product: { shopId, isDeleted: false },
        status: StockAlertStatus.ACTIVE,
        isDismissed: false,
      },
      include: {
        product: {
          include: {
            supplier: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  static async getLowStockList(shopId: string) {
    // Return products directly where stock <= reorder level
    return prisma.product.findMany({
      where: {
        shopId,
        isDeleted: false,
        isActive: true,
        currentQuantity: {
          lte: prisma.product.fields.reorderLevel,
        },
      },
      include: {
        supplier: true,
      },
      orderBy: {
        currentQuantity: 'asc',
      },
    });
  }

  static async dismissAlert(alertId: string) {
    return prisma.stockAlert.update({
      where: { id: alertId },
      data: {
        status: StockAlertStatus.DISMISSED,
        isDismissed: true,
      },
    });
  }

  static async triggerLowStockCheck(shopId: string) {
    // 1. Find all active products that are currently below reorder levels
    const lowStockProducts = await prisma.product.findMany({
      where: {
        shopId,
        isDeleted: false,
        isActive: true,
        currentQuantity: {
          lte: prisma.product.fields.reorderLevel,
        },
      },
    });

    // 2. Insert ACTIVE alerts for those products if not already active
    for (const prod of lowStockProducts) {
      const existing = await prisma.stockAlert.findFirst({
        where: {
          productId: prod.id,
          status: StockAlertStatus.ACTIVE,
        },
      });

      if (!existing) {
        await prisma.stockAlert.create({
          data: {
            productId: prod.id,
            status: StockAlertStatus.ACTIVE,
          },
        });
      }
    }

    // 3. Resolve alerts for products that are now above reorder levels
    const resolvedProducts = await prisma.product.findMany({
      where: {
        shopId,
        isDeleted: false,
        currentQuantity: {
          gt: prisma.product.fields.reorderLevel,
        },
      },
    });

    for (const prod of resolvedProducts) {
      await prisma.stockAlert.updateMany({
        where: {
          productId: prod.id,
          status: StockAlertStatus.ACTIVE,
        },
        data: {
          status: StockAlertStatus.RESOLVED,
        },
      });
    }
  }
}
