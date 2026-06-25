'use server';

import { ExpenseRepository } from '../../db/repositories/ExpenseRepository';
import { getCurrentUser } from './auth';
import { ExpenseCategory } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function createExpenseAction(data: {
  category: ExpenseCategory;
  amount: number;
  description?: string;
  date?: string | Date;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const result = await ExpenseRepository.create({
    category: data.category,
    amount: data.amount,
    description: data.description || null,
    date: data.date ? new Date(data.date) : new Date(),
    shopId: user.shopId,
  });

  revalidatePath('/expenses');
  revalidatePath('/dashboard');
  return { success: true, expense: JSON.parse(JSON.stringify(result)) };
}

export async function listExpensesAction(page = 1, limit = 10) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const result = await ExpenseRepository.findAll(user.shopId, page, limit);
  return JSON.parse(JSON.stringify(result));
}

export async function getExpenseSummaryAction(startDate?: string, endDate?: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const sDate = startDate ? new Date(startDate) : undefined;
  const eDate = endDate ? new Date(endDate) : undefined;

  const result = await ExpenseRepository.getSummaryByCategory(user.shopId, sDate, eDate);
  return JSON.parse(JSON.stringify(result));
}
