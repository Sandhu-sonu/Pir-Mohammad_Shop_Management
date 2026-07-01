'use server';

import { prisma } from '../../db/prisma';
import { getCurrentUser } from './auth';
import { Role, BusinessType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '../permissions';
import { handleActionError } from '../errors';

export async function addCategoryAction(name: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  requirePermission(user.role, 'products.create');

  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name cannot be empty');

  try {
    const result = await prisma.category.create({
      data: {
        name: trimmed,
        shopId: user.shopId,
      },
    });
    revalidatePath('/inventory');
    return { success: true, category: JSON.parse(JSON.stringify(result)) };
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function renameCategoryAction(categoryId: string, newName: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  requirePermission(user.role, 'products.update');

  const trimmed = newName.trim();
  if (!trimmed) throw new Error('Category name cannot be empty');

  try {
    const result = await prisma.category.update({
      where: {
        id: categoryId,
        shopId: user.shopId,
      },
      data: {
        name: trimmed,
      },
    });
    revalidatePath('/inventory');
    return { success: true, category: JSON.parse(JSON.stringify(result)) };
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function deleteCategoryAction(categoryId: string, reassignCategoryId?: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  requirePermission(user.role, 'products.delete');

  try {
    const productCount = await prisma.product.count({
      where: {
        categoryId,
        shopId: user.shopId,
        isDeleted: false,
      },
    });

    if (productCount > 0) {
      if (!reassignCategoryId) {
        return { success: false, inUse: true, count: productCount };
      }

      const targetCategory = await prisma.category.findUnique({
        where: {
          id: reassignCategoryId,
          shopId: user.shopId,
        },
      });

      if (!targetCategory) {
        throw new Error('Target category for reassignment not found');
      }

      await prisma.$transaction(async (tx) => {
        await tx.product.updateMany({
          where: {
            categoryId,
            shopId: user.shopId,
            isDeleted: false,
          },
          data: {
            categoryId: targetCategory.id,
            categoryName: targetCategory.name,
          },
        });

        await tx.category.delete({
          where: {
            id: categoryId,
            shopId: user.shopId,
          },
        });
      });
    } else {
      await prisma.category.delete({
        where: {
          id: categoryId,
          shopId: user.shopId,
        },
      });
    }

    revalidatePath('/inventory');
    return { success: true };
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function importRecommendedCategoriesAction(businessType: BusinessType) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  requirePermission(user.role, 'products.create');

  try {
    await prisma.$transaction(async (tx) => {
      await seedDefaultCategories(tx, user.shopId, businessType);
    });
    revalidatePath('/inventory');
    return { success: true };
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function listCategoriesDetailedAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  
  const categories = await prisma.category.findMany({
    where: { shopId: user.shopId },
    orderBy: { name: 'asc' },
  });
  return JSON.parse(JSON.stringify(categories));
}

export async function seedDefaultCategories(tx: any, shopId: string, businessType: BusinessType) {
  const defaults: Record<BusinessType, string[]> = {
    GENERAL_STORE: ['Grocery', 'Dairy', 'Snacks', 'Beverages', 'General'],
    GROCERY: ['Rice', 'Flour', 'Oil', 'Dairy'],
    DAIRY: ['Milk', 'Cheese', 'Butter', 'Yogurt'],
    BAKERY: ['Bread', 'Cakes', 'Cookies', 'Pastries'],
    SWEET_SHOP: ['Sweets', 'Snacks', 'Beverages'],
    HARDWARE: ['Cement', 'Paint', 'Pipes', 'Tools'],
    BUILDING_MATERIAL: ['Cement', 'Sand', 'Bricks', 'Steel'],
    PAINT: ['Emulsion', 'Primer', 'Brushes', 'Thinners'],
    ELECTRICAL: ['Wires', 'Switches', 'Lights', 'Fans'],
    MOBILE: ['Smartphones', 'Chargers', 'Accessories', 'Screen Guards'],
    COMPUTER: ['Laptops', 'Keyboards', 'Mice', 'Monitors'],
    ELECTRONICS: ['TV', 'Refrigerators', 'Washing Machines', 'ACs'],
    GARMENTS: ["Men's Wear", "Women's Wear", "Kids Wear"],
    FOOTWEAR: ['Shoes', 'Slippers', 'Sandals'],
    COSMETICS: ['Makeup', 'Skincare', 'Perfumes'],
    STATIONERY: ['Pens', 'Notebooks', 'Folders', 'Art Supplies'],
    BOOK_STORE: ['Textbooks', 'Novels', 'Comics', 'Magazines'],
    SPORTS: ['Bats', 'Balls', 'Rackets', 'Fitness Gear'],
    FURNITURE: ['Chairs', 'Tables', 'Sofas', 'Beds'],
    AUTO_PARTS: ['Tyres', 'Engine Oil', 'Filters', 'Brakes'],
    PESTICIDE: ['Pesticides', 'Herbicides', 'Fungicides'],
    SEED: ['Grain Seeds', 'Vegetable Seeds', 'Flower Seeds'],
    FERTILIZER: ['Urea', 'DAP', 'Potash', 'Organic Fertilizer'],
    WHOLESALE: ['Bulk Goods', 'Packaged Items'],
    MEDICAL: ['Medicines', 'Surgicals', 'OTC Products', 'Supplements'],
  };

  const categories = defaults[businessType] || ['General'];

  for (const name of categories) {
    await tx.category.upsert({
      where: {
        shopId_name: {
          shopId,
          name,
        },
      },
      create: {
        name,
        shopId,
      },
      update: {},
    });
  }
}
