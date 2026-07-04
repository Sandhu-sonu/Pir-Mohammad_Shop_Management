'use server';

import { prisma } from '@/db/prisma';
import { getCurrentUser } from './auth';
import { Role, SupportTicketStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Helper to assert current user is indeed a Super Admin
async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  
  // Since impersonating updates the role to VIEW_ONLY, we check DB user role
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { id: true, role: true }
  });
  if (!dbUser || dbUser.role !== Role.SUPER_ADMIN) {
    throw new Error('Forbidden: Super Admin access only');
  }
  return dbUser;
}

export async function toggleShopSuspensionAction(shopId: string, suspend: boolean) {
  try {
    await assertAdmin();

    await prisma.shop.update({
      where: { id: shopId },
      data: { isSuspended: suspend }
    });

    // Log in AuditLog
    await prisma.auditLog.create({
      data: {
        shopId,
        action: suspend ? 'Suspended Shop' : 'Activated Shop',
        module: 'SaaS',
        entity: 'Shop',
        details: `Shop suspension status updated to ${suspend}.`
      }
    });

    return { success: true };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: err.message };
  }
}

export async function resetShopOwnerPasswordAction(shopId: string, newPasswordInput: string) {
  try {
    await assertAdmin();

    if (!newPasswordInput || newPasswordInput.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    // Find the OWNER user for this shop
    const owner = await prisma.user.findFirst({
      where: { shopId, role: Role.OWNER }
    });

    if (!owner) {
      return { success: false, error: 'Owner account not found for this shop' };
    }

    const hashedPassword = await bcrypt.hash(newPasswordInput, 10);
    await prisma.user.update({
      where: { id: owner.id },
      data: { password: hashedPassword }
    });

    // Log in AuditLog
    await prisma.auditLog.create({
      data: {
        shopId,
        action: 'Reset Owner Password',
        module: 'SaaS',
        entity: 'User',
        details: 'Password was updated by Super Admin.'
      }
    });

    return { success: true };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: err.message };
  }
}

export async function assignTicketAction(ticketId: string, adminUserId: string) {
  try {
    await assertAdmin();

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        assignedToUserId: adminUserId,
        status: SupportTicketStatus.IN_PROGRESS
      }
    });

    return { success: true };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: err.message };
  }
}

export async function addTicketMessageAction(ticketId: string, message: string) {
  try {
    const admin = await assertAdmin();

    if (!message.trim()) {
      return { success: false, error: 'Message cannot be empty' };
    }

    await prisma.$transaction([
      prisma.supportTicketMessage.create({
        data: {
          ticketId,
          userId: admin.id,
          message
        }
      }),
      prisma.supportTicket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() }
      })
    ]);

    return { success: true };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: err.message };
  }
}
