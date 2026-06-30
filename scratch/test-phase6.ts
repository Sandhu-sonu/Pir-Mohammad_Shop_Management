import 'dotenv/config';
import { prisma } from '../src/db/prisma';
import { ExpenseRepository } from '../src/db/repositories/ExpenseRepository';
import { DailyClosingRepository } from '../src/db/repositories/DailyClosingRepository';
import { ProfitService } from '../src/db/services/ProfitService';
import { CustomerRepository } from '../src/db/repositories/CustomerRepository';
import { SupplierRepository } from '../src/db/repositories/SupplierRepository';
import { SalesRepository } from '../src/db/repositories/SalesRepository';
import { Prisma } from '@prisma/client';

async function runPhase6Tests() {
  console.log('==================================================');
  console.log('       RUNNING PHASE 6 FINANCIAL OPERATIONS TESTS   ');
  console.log('==================================================\n');

  // Setup test environment
  const shop = await prisma.shop.create({
    data: {
      name: 'Phase 6 Test Shop',
      settings: {
        create: {
          language: 'en',
          theme: 'light',
          lowStockAlert: true,
        },
      },
    },
  });

  const owner = await prisma.user.create({
    data: {
      name: 'Test Owner',
      mobile: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
      password: 'testpassword123',
      role: 'OWNER',
      shopId: shop.id,
    },
  });

  const staff = await prisma.user.create({
    data: {
      name: 'Test Staff',
      mobile: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
      password: 'testpassword123',
      role: 'STAFF',
      shopId: shop.id,
    },
  });

  const product = await prisma.product.create({
    data: {
      nameEn: 'Test Apple 1kg',
      namePa: 'ਸੇਬ 1 ਕਿਲੋ',
      sku: `SKU-${Date.now()}`,
      unit: 'PCS',
      purchasePrice: new Prisma.Decimal('100.00'), // cost: 100
      sellingPrice: new Prisma.Decimal('150.00'),  // price: 150
      currentQuantity: new Prisma.Decimal('50'),
      minStock: new Prisma.Decimal('5'),
      shopId: shop.id,
    },
  });

  const customer = await prisma.customer.create({
    data: {
      name: 'Test Customer Khata',
      openingBalance: new Prisma.Decimal('0.00'),
      currentBalance: new Prisma.Decimal('0.00'),
      shopId: shop.id,
    },
  });

  console.log('✔ Test entities successfully seeded.');

  try {
    // ----------------------------------------------------
    // TEST 1: Expense Creation, Edits & Soft Reversals
    // ----------------------------------------------------
    console.log('\n--- TEST 1: Expense Log ---');
    const exp1 = await ExpenseRepository.create({
      category: 'Rent',
      amount: 1000,
      description: 'Monthly warehouse rent',
      paymentMethod: 'CASH',
      notes: 'Paid in cash',
      userId: owner.id,
      shopId: shop.id,
    });
    console.log(`✔ Created Cash Expense: ₹${exp1.amount}`);

    const exp2 = await ExpenseRepository.create({
      category: 'Tea & Refreshments',
      amount: 50,
      description: 'Tea for guests',
      paymentMethod: 'CASH',
      userId: owner.id,
      shopId: shop.id,
    });
    console.log(`✔ Created Tea Expense: ₹${exp2.amount}`);

    // Update expense
    const updatedExp2 = await ExpenseRepository.update(exp2.id, {
      amount: 60,
      notes: 'Added biscuits too',
    });
    console.log(`✔ Updated Expense amount to: ₹${updatedExp2.amount}`);
    if (Number(updatedExp2.amount) !== 60) throw new Error('Expense amount update failed');

    // Reverse expense (Soft Reversal)
    const reversed = await ExpenseRepository.reverse(exp2.id, owner.id, 'Accidental duplicate entry');
    console.log(`✔ Soft Reversed Expense (isReversed: ${reversed.isReversed}, reason: "${reversed.reversalReason}")`);
    if (!reversed.isReversed) throw new Error('Expense soft-reversal failed');

    // ----------------------------------------------------
    // TEST 2: Dynamic Profit Engine (Revenue - COGS - Expenses)
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Profit Engine ---');
    // Log a Cash Sale: 10 items sold at 150 each (Total: 1500)
    // COGS = 10 items * 100 = 1000. Gross Profit = 1500 - 1000 = 500
    // Expenses = Rent of 1000 (Exp 2 is reversed, so ignored).
    // Net Profit = 500 (Gross) - 1000 (Expenses) = -500.
    const sale = await SalesRepository.create({
      shopId: shop.id,
      userId: owner.id,
      items: [{ productId: product.id, quantity: 10, sellingPrice: 150 }],
      paidAmount: 1500,
      paymentMethod: 'CASH',
      discount: 0,
    });
    console.log(`✔ Completed Cash Sale. Invoice: ${sale.invoiceNumber}, Total: ₹${sale.total}`);

    const todayStart = new Date();
    const stats = await ProfitService.calculateProfit(shop.id, todayStart, todayStart);
    console.log(`✔ Profit calculations:`);
    console.log(`   Revenue: ₹${stats.revenue} (expected: 1500)`);
    console.log(`   COGS: ₹${stats.cogs} (expected: 1000)`);
    console.log(`   Gross Profit: ₹${stats.grossProfit} (expected: 500)`);
    console.log(`   Expenses: ₹${stats.expenses} (expected: 1000)`);
    console.log(`   Net Profit: ₹${stats.netProfit} (expected: -500)`);

    if (stats.revenue !== 1500 || stats.cogs !== 1000 || stats.expenses !== 1000 || stats.netProfit !== -500) {
      throw new Error('Profit engine calculations mismatch!');
    }

    // ----------------------------------------------------
    // TEST 3: Cash flow reconciliation (Expected Cash vs Actual Cash Count)
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Cash Flow Reconciliation ---');
    // Let's create customer recovery: customer pays ₹200 cash
    await CustomerRepository.receivePayment(shop.id, customer.id, 200, 'Khata recovery cash', 'CASH');
    console.log('✔ Customer paid ₹200 in CASH.');

    // Let's create supplier payment: supplier paid ₹100 cash
    const supplier = await SupplierRepository.create({
      name: 'Test Supplier Dues',
      currentBalance: 500,
      shopId: shop.id,
    });
    await SupplierRepository.paySupplier(shop.id, supplier.id, 100, 'Partial cash supplier payment', 'CASH');
    console.log('✔ Paid supplier ₹100 in CASH.');

    // Calculate metrics for Daily Closing
    // Opening cash = suggested 0.
    // Cash Sales = 1500
    // Customer Recoveries (Cash) = 200
    // Cash Expenses = 1000
    // Supplier Cash Payments = 100
    // Expected Cash = 0 + 1500 + 200 - 1000 - 100 = 600
    const closingMetrics = await DailyClosingRepository.calculateClosingMetrics(shop.id, todayStart);
    console.log('✔ Closing Metrics:');
    console.log(`   Cash Sales: ₹${closingMetrics.salesCash} (expected: 1500)`);
    console.log(`   Recoveries: ₹${closingMetrics.paymentsReceivedCash} (expected: 200)`);
    console.log(`   Expenses: ₹${closingMetrics.expensesCash} (expected: 1000)`);
    console.log(`   Supplier Paid: ₹${closingMetrics.supplierPaymentsCash} (expected: 100)`);

    const expectedCash = 
      closingMetrics.suggestedOpeningCash +
      closingMetrics.salesCash +
      closingMetrics.paymentsReceivedCash -
      closingMetrics.expensesCash -
      closingMetrics.supplierPaymentsCash;

    console.log(`   Expected Cash in Drawer: ₹${expectedCash} (expected: 600)`);
    if (expectedCash !== 600) throw new Error('Expected cash calculation mismatch!');

    // ----------------------------------------------------
    // TEST 4: Daily Closing Lock & Reversal
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Daily Closing Lock & Reversal ---');
    // Save daily closing with actual cash count: ₹580 (Shortage of ₹20)
    const closing = await DailyClosingRepository.saveClosing({
      shopId: shop.id,
      date: todayStart,
      openingCash: 0,
      closingCash: 580,
      withdrawals: 0,
      notes: 'Shortage of 20 Rs today',
      staffSignature: 'Staff Sign',
      staffUserId: staff.id,
      ownerSignature: 'Owner Sign',
      ownerUserId: owner.id,
      userId: owner.id,
    });

    console.log(`✔ Daily Closing Locked: ${closing.isLocked}, Difference: ₹${closing.difference}`);
    if (!closing.isLocked || Number(closing.difference) !== -20) {
      throw new Error('Daily closing saving or difference tracking failed!');
    }

    // Verify day closing soft-reversal
    const closedReversed = await DailyClosingRepository.reverseClosing(closing.id, owner.id, 'Wrong cash count input');
    console.log(`✔ Reversed Daily Closing (isReversed: ${closedReversed.isReversed}, reason: "${closedReversed.reversalReason}")`);
    if (!closedReversed.isReversed || closedReversed.isLocked) {
      throw new Error('Daily closing soft-reversal failed!');
    }

    console.log('\n==================================================');
    console.log('     🎉 ALL PHASE 6 FINANCIAL TESTS PASSED!       ');
    console.log('==================================================\n');

  } finally {
    // Cleanup mock tables
    await prisma.dailyClosing.deleteMany({ where: { shopId: shop.id } });
    await prisma.expense.deleteMany({ where: { shopId: shop.id } });
    await prisma.supplierLedger.deleteMany({ where: { supplier: { shopId: shop.id } } });
    await prisma.supplier.deleteMany({ where: { shopId: shop.id } });
    await prisma.payment.deleteMany({ where: { customer: { shopId: shop.id } } });
    await prisma.customerLedger.deleteMany({ where: { customer: { shopId: shop.id } } });
    await prisma.customer.deleteMany({ where: { shopId: shop.id } });
    await prisma.saleItem.deleteMany({ where: { sale: { shopId: shop.id } } });
    await prisma.sale.deleteMany({ where: { shopId: shop.id } });
    await prisma.product.deleteMany({ where: { shopId: shop.id } });
    await prisma.user.delete({ where: { id: owner.id } });
    await prisma.user.delete({ where: { id: staff.id } });
    await prisma.settings.deleteMany({ where: { shopId: shop.id } });
    await prisma.shop.delete({ where: { id: shop.id } });
    console.log('✔ Cleanup complete.');
  }
}

runPhase6Tests().catch((err) => {
  console.error('❌ Test execution failed with error:', err);
  process.exit(1);
});
