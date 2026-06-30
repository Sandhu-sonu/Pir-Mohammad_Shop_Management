import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

export interface ProductFilterInput {
  search?: string;
  category?: string;
  lowStockOnly?: boolean;
  shopId: string;
  page?: number;
  limit?: number;
}

export class ProductRepository {
  static async findById(id: string) {
    return prisma.product.findUnique({
      where: { id, isDeleted: false },
      include: { supplier: true, category: true, brand: true },
    });
  }

  static async findByBarcode(shopId: string, barcode: string) {
    return prisma.product.findFirst({
      where: { shopId, barcode, isDeleted: false },
      include: { category: true, brand: true },
    });
  }

  static async findAll(filters: ProductFilterInput) {
    const { search, category, lowStockOnly, shopId, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      shopId,
      isDeleted: false,
    };

    if (search) {
      where.OR = [
        { nameEn: { contains: search, mode: 'insensitive' } },
        { namePa: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { manufacturer: { contains: search, mode: 'insensitive' } },
        { modelNumber: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { imei: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category && category !== 'ALL') {
      where.categoryName = { equals: category, mode: 'insensitive' };
    }

    if (lowStockOnly) {
      where.AND = [
        {
          currentQuantity: {
            lte: prisma.product.fields.reorderLevel,
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: { supplier: true, category: true, brand: true },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      items,
      total,
      pages: Math.ceil(total / limit),
      page,
      limit,
    };
  }

  static async create(data: Omit<Prisma.ProductCreateInput, 'shop' | 'supplier'> & { shopId: string; supplierId?: string | null }) {
    const { shopId, supplierId, ...rest } = data;
    return prisma.product.create({
      data: {
        ...rest,
        shop: { connect: { id: shopId } },
        supplier: supplierId ? { connect: { id: supplierId } } : undefined,
      },
    });
  }

  static async update(id: string, data: Prisma.ProductUpdateInput) {
    return prisma.product.update({
      where: { id },
      data,
    });
  }

  static async softDelete(id: string) {
    return prisma.product.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  static async getCategories(shopId: string): Promise<string[]> {
    const categories = await prisma.category.findMany({
      where: { shopId },
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    return categories.map((c) => c.name);
  }
}
