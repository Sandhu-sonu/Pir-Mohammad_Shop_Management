'use server';

import { prisma } from '../../db/prisma';
import { getCurrentUser } from './auth';
import { revalidatePath } from 'next/cache';

export async function updateShopSettingsAction(data: {
  name: string;
  address?: string;
  gst?: string;
  language: string;
  theme: string;
  lowStockAlert: boolean;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const shopId = user.shopId;

  await prisma.$transaction(async (tx) => {
    // 1. Update Shop name, address, gst
    await tx.shop.update({
      where: { id: shopId },
      data: {
        name: data.name,
        address: data.address || null,
        gst: data.gst || null,
      },
    });

    // 2. Update or create settings record
    await tx.settings.upsert({
      where: { shopId },
      update: {
        language: data.language,
        theme: data.theme,
        lowStockAlert: data.lowStockAlert,
      },
      create: {
        shopId,
        language: data.language,
        theme: data.theme,
        lowStockAlert: data.lowStockAlert,
      },
    });
  });

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
}
