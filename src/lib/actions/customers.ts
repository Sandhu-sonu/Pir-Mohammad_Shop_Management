'use server';

import { CustomerService } from '../../db/services/CustomerService';
import { getCurrentUser } from './auth';
import { revalidatePath } from 'next/cache';

export async function getCustomersAction(filters: { search?: string; page?: number; limit?: number }) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const result = await CustomerService.listCustomers({
    ...filters,
    shopId: user.shopId,
  });

  return JSON.parse(JSON.stringify(result));
}

export async function addCustomerAction(data: {
  name: string;
  mobile?: string;
  address?: string;
  notes?: string;
  openingBalance?: number;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const result = await CustomerService.addCustomer({
    ...data,
    shopId: user.shopId,
  });

  revalidatePath('/customers');
  revalidatePath('/dashboard');
  return { success: true, customer: JSON.parse(JSON.stringify(result)) };
}

export async function updateCustomerAction(
  id: string,
  data: Partial<{
    name: string;
    mobile: string;
    address: string;
    notes: string;
  }>
) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const result = await CustomerService.updateCustomer(id, data);

  revalidatePath('/customers');
  return { success: true, customer: JSON.parse(JSON.stringify(result)) };
}

export async function deleteCustomerAction(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  await CustomerService.deleteCustomer(id);

  revalidatePath('/customers');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function getCustomerLedgerAction(customerId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const result = await CustomerService.getCustomerLedger(customerId);
  return JSON.parse(JSON.stringify(result));
}

export async function receivePaymentAction(customerId: string, amount: number, note?: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const result = await CustomerService.receivePayment(user.shopId, customerId, amount, note);

  revalidatePath(`/customers/${customerId}`);
  revalidatePath('/customers');
  revalidatePath('/dashboard');
  return { success: true, ...JSON.parse(JSON.stringify(result)) };
}

export async function getCustomerProfileAction(customerId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const result = await CustomerService.getCustomerProfile(customerId);
  return JSON.parse(JSON.stringify(result));
}
