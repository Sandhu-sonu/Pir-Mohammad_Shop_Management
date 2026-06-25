import { prisma } from '../prisma';

export class ProductImportRepository {
  static async createImportLog(data: {
    shopId: string;
    filename: string;
    importedCount: number;
    updatedCount: number;
    failedCount: number;
    createdCategoriesCount: number;
    createdBrandsCount: number;
    status: string;
    errors: { rowNum: number; sku?: string; errorMsg: string; rawData?: string }[];
  }) {
    return prisma.productImport.create({
      data: {
        shopId: data.shopId,
        filename: data.filename,
        importedCount: data.importedCount,
        updatedCount: data.updatedCount,
        failedCount: data.failedCount,
        createdCategoriesCount: data.createdCategoriesCount,
        createdBrandsCount: data.createdBrandsCount,
        status: data.status,
        errors: {
          create: data.errors.map((e) => ({
            rowNum: e.rowNum,
            sku: e.sku || null,
            errorMsg: e.errorMsg,
            rawData: e.rawData || null,
          })),
        },
      },
    });
  }

  static async getImportHistory(shopId: string) {
    return prisma.productImport.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      include: {
        errors: {
          orderBy: { rowNum: 'asc' },
        },
      },
    });
  }
}
