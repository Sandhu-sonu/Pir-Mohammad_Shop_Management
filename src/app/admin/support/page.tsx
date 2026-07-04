import React from 'react';
import { prisma } from '@/db/prisma';
import { Role } from '@prisma/client';
import SupportTicketManager from './SupportTicketManager';

export default async function AdminSupportPage() {
  // Fetch tickets and their message logs
  const tickets = await prisma.supportTicket.findMany({
    where: { deletedAt: null },
    include: {
      shop: { select: { name: true } },
      user: { select: { name: true, mobile: true } },
      messages: {
        include: { user: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'asc' }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  // Fetch all admin users who can be assigned to tickets
  const admins = await prisma.user.findMany({
    where: { role: Role.SUPER_ADMIN },
    select: { id: true, name: true }
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Support Center / ਗਾਹਕ ਸਹਾਇਤਾ</h2>
        <p className="text-gray-400 text-sm mt-1">Manage help tickets and chat with shop owners to resolve issues</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <SupportTicketManager
          initialTickets={tickets.map(t => ({
            id: t.id,
            shopName: t.shop.name,
            ownerName: t.user.name,
            mobile: t.user.mobile,
            title: t.title,
            status: t.status,
            priority: t.priority,
            assignedToUserId: t.assignedToUserId || '',
            messages: t.messages.map(m => ({
              id: m.id,
              userId: m.userId,
              userName: m.user.name,
              userRole: m.user.role,
              message: m.message,
              createdAt: m.createdAt
            }))
          }))}
          admins={admins}
        />
      </div>
    </div>
  );
}
