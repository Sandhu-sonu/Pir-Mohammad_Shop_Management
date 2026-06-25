import { prisma } from '../prisma';

export class BarcodeRepository {
  static async getOrCreateActiveSession(shopId: string, userId: string) {
    const existing = await prisma.barcodeScanSession.findFirst({
      where: { shopId, userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) return existing;

    return prisma.barcodeScanSession.create({
      data: {
        shopId,
        userId,
        isActive: true,
      },
    });
  }

  static async logBarcodeScan(sessionId: string, barcode: string) {
    return prisma.barcodeLog.create({
      data: {
        sessionId,
        barcode,
      },
    });
  }

  static async getSessionLogs(sessionId: string) {
    return prisma.barcodeLog.findMany({
      where: { sessionId },
      orderBy: { scannedAt: 'desc' },
    });
  }

  static async deactivateActiveSession(shopId: string, userId: string) {
    return prisma.barcodeScanSession.updateMany({
      where: { shopId, userId, isActive: true },
      data: { isActive: false },
    });
  }

  static async lookupBarcode(shopId: string, barcode: string, userId: string) {
    const startTime = Date.now();
    const session = await this.getOrCreateActiveSession(shopId, userId);
    
    // Log audit trail
    await this.logBarcodeScan(session.id, barcode);

    // Query product
    const product = await prisma.product.findFirst({
      where: { shopId, barcode, isDeleted: false },
      include: { category: true, brand: true },
    });

    const elapsed = Date.now() - startTime;
    console.log(`[Barcode Lookup Audit] Barcode: ${barcode}, Lookup Time: ${elapsed}ms`);

    return product;
  }
}
