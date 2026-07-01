'use server';

import { prisma } from '../../db/prisma';
import { getCurrentUser } from './auth';
import { revalidatePath } from 'next/cache';
import { Role, BusinessType, ReceiptFormat, PrinterType, DiscountType } from '@prisma/client';
import { requirePermission } from '../permissions';
import { seedDefaultCategories } from './categories';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function uploadLogoAction(formData: FormData): Promise<{ success: boolean; logoPath?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  requirePermission(user.role, 'settings.write');

  try {
    const file = formData.get('logo') as File;
    if (!file) {
      return { success: false, error: 'No file uploaded' };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });
    
    const filename = `logo_${user.shopId}.png`;
    const filePath = join(uploadDir, filename);
    await writeFile(filePath, buffer);

    const logoPath = `/uploads/${filename}`;
    
    await prisma.shop.update({
      where: { id: user.shopId },
      data: { logo: logoPath },
    });

    revalidatePath('/settings');
    return { success: true, logoPath };
  } catch (err: any) {
    console.error('Logo upload error:', err);
    return { success: false, error: err.message || 'Failed to upload logo' };
  }
}

export async function updateShopSettingsAction(data: {
  name: string;
  address?: string;
  gst?: string;
  phone?: string;
  email?: string;
  footerMessage?: string;
  returnPolicy?: string;
  logo?: string;
  language: string;
  theme: string;
  lowStockAlert: boolean;
  businessType?: BusinessType;
  gstRegistered?: boolean;
  receiptFormat?: ReceiptFormat;
  printerType?: PrinterType;
  receiptPrefix?: string;
  taxPrefix?: string;
  currencySymbol?: string;
  decimalPrecision?: number;
  dateFormat?: string;
  allowItemDiscount?: boolean;
  allowBillDiscount?: boolean;
  maxStaffDiscount?: number;
  requireDiscountReason?: boolean;
  reasonPercentLimit?: number;
  reasonAmountLimit?: number;
  autoSuggestPunjabi?: boolean;
  autoSuggestEnglish?: boolean;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  requirePermission(user.role, 'settings.write');

  const shopId = user.shopId;

  await prisma.$transaction(async (tx) => {
    const updateData: any = {
      name: data.name,
      address: data.address || null,
      gst: data.gst || null,
      phone: data.phone || null,
      email: data.email || null,
      footerMessage: data.footerMessage || null,
      returnPolicy: data.returnPolicy || null,
      logo: data.logo || null,
      gstRegistered: data.gstRegistered !== undefined ? data.gstRegistered : false,
    };

    if (data.businessType) {
      if (user.role !== Role.OWNER) {
        throw new Error('Only OWNER can change the shop Business Type');
      }
      updateData.businessType = data.businessType;
      await seedDefaultCategories(tx, shopId, data.businessType);
    }

    await tx.shop.update({
      where: { id: shopId },
      data: updateData,
    });

    await tx.settings.upsert({
      where: { shopId },
      update: {
        language: data.language,
        theme: data.theme,
        lowStockAlert: data.lowStockAlert,
        receiptFormat: data.receiptFormat || ReceiptFormat.SIMPLE,
        printerType: data.printerType || PrinterType.THERMAL_80,
        receiptPrefix: data.receiptPrefix || 'RCP-',
        taxPrefix: data.taxPrefix || 'INV-',
        currencySymbol: data.currencySymbol || '₹',
        decimalPrecision: data.decimalPrecision !== undefined ? Number(data.decimalPrecision) : 2,
        dateFormat: data.dateFormat || 'DD/MM/YYYY',
        allowItemDiscount: data.allowItemDiscount !== undefined ? data.allowItemDiscount : true,
        allowBillDiscount: data.allowBillDiscount !== undefined ? data.allowBillDiscount : true,
        maxStaffDiscount: data.maxStaffDiscount !== undefined ? data.maxStaffDiscount : 10.00,
        requireDiscountReason: data.requireDiscountReason !== undefined ? data.requireDiscountReason : false,
        reasonPercentLimit: data.reasonPercentLimit !== undefined ? data.reasonPercentLimit : 15.00,
        reasonAmountLimit: data.reasonAmountLimit !== undefined ? data.reasonAmountLimit : 500.00,
        autoSuggestPunjabi: data.autoSuggestPunjabi !== undefined ? data.autoSuggestPunjabi : true,
        autoSuggestEnglish: data.autoSuggestEnglish !== undefined ? data.autoSuggestEnglish : true,
      },
      create: {
        shopId,
        language: data.language,
        theme: data.theme,
        lowStockAlert: data.lowStockAlert,
        receiptFormat: data.receiptFormat || ReceiptFormat.SIMPLE,
        printerType: data.printerType || PrinterType.THERMAL_80,
        receiptPrefix: data.receiptPrefix || 'RCP-',
        taxPrefix: data.taxPrefix || 'INV-',
        currencySymbol: data.currencySymbol || '₹',
        decimalPrecision: data.decimalPrecision !== undefined ? Number(data.decimalPrecision) : 2,
        dateFormat: data.dateFormat || 'DD/MM/YYYY',
        allowItemDiscount: data.allowItemDiscount !== undefined ? data.allowItemDiscount : true,
        allowBillDiscount: data.allowBillDiscount !== undefined ? data.allowBillDiscount : true,
        maxStaffDiscount: data.maxStaffDiscount !== undefined ? data.maxStaffDiscount : 10.00,
        requireDiscountReason: data.requireDiscountReason !== undefined ? data.requireDiscountReason : false,
        reasonPercentLimit: data.reasonPercentLimit !== undefined ? data.reasonPercentLimit : 15.00,
        reasonAmountLimit: data.reasonAmountLimit !== undefined ? data.reasonAmountLimit : 500.00,
        autoSuggestPunjabi: data.autoSuggestPunjabi !== undefined ? data.autoSuggestPunjabi : true,
        autoSuggestEnglish: data.autoSuggestEnglish !== undefined ? data.autoSuggestEnglish : true,
      },
    });
  });

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
}
