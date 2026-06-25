import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

export function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed
    .toLowerCase()
    .replace(/\s+/g, ' ') // normalize inner spaces
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export class CategoryBrandRepository {
  static async findOrCreateCategory(tx: Prisma.TransactionClient, shopId: string, rawName: string) {
    const normalized = normalizeName(rawName);
    if (!normalized) return null;

    // Find first case-insensitively or create
    const existing = await tx.category.findFirst({
      where: {
        shopId,
        name: { equals: normalized, mode: 'insensitive' },
      },
    });

    if (existing) return existing;

    return tx.category.create({
      data: {
        name: normalized,
        shopId,
      },
    });
  }

  static async findOrCreateBrand(tx: Prisma.TransactionClient, shopId: string, rawName: string) {
    const normalized = normalizeName(rawName);
    if (!normalized) return null;

    const existing = await tx.brand.findFirst({
      where: {
        shopId,
        name: { equals: normalized, mode: 'insensitive' },
      },
    });

    if (existing) return existing;

    return tx.brand.create({
      data: {
        name: normalized,
        shopId,
      },
    });
  }
}
