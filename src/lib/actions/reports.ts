'use server';

import { prisma } from '../../db/prisma';
import { getCurrentUser } from './auth';

export async function getSalesReportDataAction(startDate: string, endDate: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  if (user.role !== 'OWNER' && user.role !== 'MANAGER') throw new Error('Permission denied');

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const sales = await prisma.sale.findMany({
    where: {
      shopId: user.shopId,
      date: { gte: start, lte: end },
    },
    include: {
      customer: { select: { name: true } },
      items: {
        include: {
          product: { select: { nameEn: true, namePa: true, sku: true } },
        },
      },
      createdByUser: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  });

  return JSON.parse(JSON.stringify(sales));
}

export async function getExpensesReportDataAction(startDate: string, endDate: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  if (user.role !== 'OWNER' && user.role !== 'MANAGER') throw new Error('Permission denied');

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const expenses = await prisma.expense.findMany({
    where: {
      shopId: user.shopId,
      date: { gte: start, lte: end },
    },
    include: {
      user: { select: { name: true } },
      reversedByUser: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  });

  return JSON.parse(JSON.stringify(expenses));
}

export async function getDailyClosingReportDataAction(startDate: string, endDate: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  if (user.role !== 'OWNER' && user.role !== 'MANAGER') throw new Error('Permission denied');

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const closings = await prisma.dailyClosing.findMany({
    where: {
      shopId: user.shopId,
      date: { gte: start, lte: end },
    },
    include: {
      user: { select: { name: true } },
      staffUser: { select: { name: true } },
      ownerUser: { select: { name: true } },
      reversedByUser: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  });

  return JSON.parse(JSON.stringify(closings));
}

export async function getOutstandingCustomersAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  if (user.role !== 'OWNER' && user.role !== 'MANAGER') throw new Error('Permission denied');

  const customers = await prisma.customer.findMany({
    where: {
      shopId: user.shopId,
      isDeleted: false,
      currentBalance: { gt: 0 },
    },
    orderBy: { name: 'asc' },
  });

  return JSON.parse(JSON.stringify(customers));
}

export async function getOutstandingSuppliersAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  if (user.role !== 'OWNER' && user.role !== 'MANAGER') throw new Error('Permission denied');

  const suppliers = await prisma.supplier.findMany({
    where: {
      shopId: user.shopId,
      isDeleted: false,
      currentBalance: { gt: 0 },
    },
    orderBy: { name: 'asc' },
  });

  return JSON.parse(JSON.stringify(suppliers));
}

export async function getInventoryValuationAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  if (user.role !== 'OWNER' && user.role !== 'MANAGER') throw new Error('Permission denied');

  const products = await prisma.product.findMany({
    where: {
      shopId: user.shopId,
      isDeleted: false,
    },
    orderBy: { nameEn: 'asc' },
  });

  return JSON.parse(JSON.stringify(products));
}
