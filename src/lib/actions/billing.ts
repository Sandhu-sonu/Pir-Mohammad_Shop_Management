'use server';

import { prisma } from '@/db/prisma';
import { getCurrentUser } from './auth';
import { Role, SaaSInvoiceStatus } from '@prisma/client';
import { BillingService } from '@/db/services/BillingService';
import { revalidatePath } from 'next/cache';

async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { id: true, role: true }
  });
  if (!dbUser || dbUser.role !== Role.SUPER_ADMIN) {
    throw new Error('Forbidden: Super Admin access only');
  }
  return dbUser;
}

export async function createInvoiceAction(shopId: string, planId: string) {
  try {
    await assertAdmin();
    const invoice = await BillingService.generateInvoice(shopId, planId);
    revalidatePath('/admin/billing');
    return { success: true, invoiceId: invoice.id };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: err.message };
  }
}

export async function markPaidAction(
  invoiceId: string,
  paymentMethod: string,
  gateway: string,
  gatewayRef?: string,
  transactionId?: string
) {
  try {
    await assertAdmin();
    const res = await BillingService.processPayment(invoiceId, paymentMethod, gateway, gatewayRef, transactionId);
    revalidatePath('/admin/billing');
    revalidatePath('/admin/shops');
    return res;
  } catch (err: any) {
    console.error(err);
    return { success: false, error: err.message };
  }
}

export async function cancelInvoiceAction(invoiceId: string) {
  try {
    await assertAdmin();
    await prisma.saaSInvoice.update({
      where: { id: invoiceId },
      data: { status: SaaSInvoiceStatus.CANCELLED }
    });
    revalidatePath('/admin/billing');
    return { success: true };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: err.message };
  }
}

export async function issueRefundAction(paymentId: string, amount: number, reason: string) {
  try {
    const admin = await assertAdmin();
    const res = await BillingService.processRefund(paymentId, amount, reason, admin.id);
    revalidatePath('/admin/billing');
    return res;
  } catch (err: any) {
    console.error(err);
    return { success: false, error: err.message };
  }
}

export async function renewSubscriptionAction(shopId: string, planId: string) {
  try {
    await assertAdmin();
    // Manual renewal: generate invoice and immediately mark as paid
    const invoice = await BillingService.generateInvoice(shopId, planId);
    const res = await BillingService.processPayment(invoice.id, 'MANUAL', 'ADMIN', 'Manual Renew', `manual_${Date.now()}`);
    revalidatePath('/admin/billing');
    revalidatePath('/admin/shops');
    return res;
  } catch (err: any) {
    console.error(err);
    return { success: false, error: err.message };
  }
}

export async function generateInvoicePdfAction(invoiceId: string) {
  try {
    await assertAdmin();
    return { success: true, pdfUrl: `/api/v1/saas/invoices/${invoiceId}/pdf` };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: err.message };
  }
}
