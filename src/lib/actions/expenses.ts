'use server';

import { ExpenseRepository } from '../../db/repositories/ExpenseRepository';
import { getCurrentUser } from './auth';
import { PaymentMethod } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { AuditLogService } from '../../db/services/AuditLogService';
import { requirePermission } from '../permissions';
import { handleActionError } from '../errors';

export async function createExpenseAction(data: {
  category: string;
  amount: number;
  description?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
  date?: string | Date;
}) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    requirePermission(user.role, 'expenses.write');

    const result = await ExpenseRepository.create({
      category: data.category,
      amount: data.amount,
      description: data.description || null,
      paymentMethod: data.paymentMethod || 'CASH',
      notes: data.notes || null,
      date: data.date ? new Date(data.date) : new Date(),
      userId: user.userId,
      shopId: user.shopId,
    });

    await AuditLogService.log({
      userId: user.userId,
      action: 'Create Expense',
      module: 'Expenses',
      entity: result.id,
      after: result,
    });

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { success: true, expense: JSON.parse(JSON.stringify(result)) };
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function updateExpenseAction(
  id: string,
  data: {
    category: string;
    amount: number;
    description?: string;
    paymentMethod?: PaymentMethod;
    notes?: string;
    date?: string | Date;
  }
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    requirePermission(user.role, 'expenses.write');
    if (user.role === 'STAFF') {
      throw new Error('Permission denied: Staff cannot edit expenses');
    }

    const oldExpense = await ExpenseRepository.findById(id);
    if (!oldExpense) throw new Error('Expense not found');

    const result = await ExpenseRepository.update(id, {
      category: data.category,
      amount: data.amount,
      description: data.description || '',
      paymentMethod: data.paymentMethod,
      notes: data.notes || '',
      date: data.date ? new Date(data.date) : undefined,
    });

    await AuditLogService.log({
      userId: user.userId,
      action: 'Edit Expense',
      module: 'Expenses',
      entity: id,
      before: oldExpense,
      after: result,
    });

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { success: true, expense: JSON.parse(JSON.stringify(result)) };
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function reverseExpenseAction(id: string, reason: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    requirePermission(user.role, 'expenses.reverse');

    const oldExpense = await ExpenseRepository.findById(id);
    if (!oldExpense) throw new Error('Expense not found');
    if (oldExpense.isReversed) throw new Error('Expense is already reversed');

    const result = await ExpenseRepository.reverse(id, user.userId, reason);

    await AuditLogService.log({
      userId: user.userId,
      action: 'Reverse Expense',
      module: 'Expenses',
      entity: id,
      before: oldExpense,
      after: result,
    });

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { success: true, expense: JSON.parse(JSON.stringify(result)) };
  } catch (err: any) {
    return handleActionError(err);
  }
}

export async function listExpensesAction(page = 1, limit = 10) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  requirePermission(user.role, 'expenses.read');

  const result = await ExpenseRepository.findAll(user.shopId, page, limit);
  return JSON.parse(JSON.stringify(result));
}

export async function getExpenseSummaryAction(startDate?: string, endDate?: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  requirePermission(user.role, 'expenses.read');
  if (user.role === 'STAFF' || user.role === 'VIEW_ONLY') {
    throw new Error('Permission denied');
  }

  const sDate = startDate ? new Date(startDate) : undefined;
  const eDate = endDate ? new Date(endDate) : undefined;

  const result = await ExpenseRepository.getSummaryByCategory(user.shopId, sDate, eDate);
  return JSON.parse(JSON.stringify(result));
}
