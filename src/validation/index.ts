import { z } from 'zod';

export const loginSchema = z.object({
  mobile: z.string().min(3, { message: 'Username/Mobile must be at least 3 characters' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

export const productSchema = z.object({
  sku: z.string().optional().or(z.literal('')),
  barcode: z.string().optional().or(z.literal('')),
  nameEn: z.string().optional().or(z.literal('')),
  namePa: z.string().optional().or(z.literal('')),
  category: z.string().optional().or(z.literal('')),
  purchasePrice: z.coerce.number().min(0, { message: 'Purchase price must be positive' }).optional().default(0),
  sellingPrice: z.coerce.number().min(0, { message: 'Selling price must be positive' }).optional().default(0),
  currentQuantity: z.coerce.number().min(0, { message: 'Stock must be positive' }).optional().default(0),
  unit: z.string().optional().default('PCS'),
  minStock: z.coerce.number().min(0, { message: 'Min stock alert must be positive' }).optional().default(5),
  supplierId: z.string().optional().or(z.literal('')),

  // Optional attributes (Phase 9)
  manufacturer: z.string().optional().or(z.literal('')),
  modelNumber: z.string().optional().or(z.literal('')),
  batchNumber: z.string().optional().or(z.literal('')),
  expiryDate: z.string().optional().or(z.literal('')),
  manufacturingDate: z.string().optional().or(z.literal('')),
  warrantyMonths: z.coerce.number().optional(),
  serialNumber: z.string().optional().or(z.literal('')),
  imei: z.string().optional().or(z.literal('')),
  color: z.string().optional().or(z.literal('')),
  size: z.string().optional().or(z.literal('')),
  variant: z.string().optional().or(z.literal('')),
  hsnCode: z.string().optional().or(z.literal('')),
  gstRate: z.coerce.number().optional(),
}).refine(data => (data.nameEn && data.nameEn.trim().length > 0) || (data.namePa && data.namePa.trim().length > 0), {
  message: 'At least one name (English or Punjabi) is required',
  path: ['nameEn']
});

export const customerSchema = z.object({
  name: z.string().min(2, { message: 'Customer Name is required' }),
  mobile: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  openingBalance: z.coerce.number().min(0, { message: 'Opening balance must be positive' }),
});

export const expenseSchema = z.object({
  category: z.string().min(1, { message: 'Category is required' }),
  amount: z.coerce.number().gt(0, { message: 'Amount must be greater than zero' }),
  description: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CREDIT']).optional().default('CASH'),
  notes: z.string().optional(),
  date: z.string().optional(),
});

export const closingSchema = z.object({
  openingCash: z.coerce.number().min(0, { message: 'Opening cash must be positive' }),
  closingCash: z.coerce.number().min(0, { message: 'Closing cash must be positive' }),
  withdrawals: z.coerce.number().min(0, { message: 'Withdrawals must be positive' }).optional().default(0),
  notes: z.string().optional(),
  staffSignature: z.string().optional().or(z.literal('')),
  ownerSignature: z.string().optional().or(z.literal('')),
});
