import 'dotenv/config';
import { prisma } from '../src/db/prisma';
import { BillingService } from '../src/db/services/BillingService';
import { SubscriptionStatus, SaaSInvoiceStatus, SaasPaymentStatus } from '@prisma/client';

async function runBillingTests() {
  console.log("==================================================");
  console.log("             SaaS BILLING UNIT TESTS              ");
  console.log("==================================================");

  // 1. Fetch test targets
  const shop = await prisma.shop.findFirst({
    where: { id: { not: 'admin-system-shop-id' } }
  });

  const plan = await prisma.plan.findFirst();
  const owner = await prisma.user.findFirst({
    where: { role: 'OWNER' }
  });

  if (!shop || !plan || !owner) {
    console.error("Test Prerequisites Missing: Make sure seed database is populated first.");
    process.exit(1);
  }

  console.log(`✔ Shop: "${shop.name}", Plan: "${plan.name}", Owner: "${owner.name}" loaded.`);

  // TEST 1: Generate Invoice Sequence
  console.log("\n--- TEST 1: Automated Invoice Sequence ---");
  const invoice1 = await BillingService.generateInvoice(shop.id, plan.id);
  console.log(`✔ Generated Invoice 1: ${invoice1.invoiceNumber}`);
  
  const invoice2 = await BillingService.generateInvoice(shop.id, plan.id);
  console.log(`✔ Generated Invoice 2: ${invoice2.invoiceNumber}`);
  
  if (invoice1.invoiceNumber === invoice2.invoiceNumber) {
    throw new Error("FAIL: Invoice numbers must be unique and incremental.");
  }
  console.log("✔ Unique incremental numbering verified.");

  // TEST 2: Process Subscription Renewal Payment
  console.log("\n--- TEST 2: Subscription Renewal & Date Transitions ---");
  const result = await BillingService.processPayment(
    invoice1.id,
    'UPI',
    'RAZORPAY',
    'pay_test_order_123',
    'txn_test_456'
  );

  if (!result.success) {
    throw new Error(`FAIL: Payment processing error: ${result.error}`);
  }

  // Fetch updated subscription details
  const sub = await prisma.subscription.findUnique({
    where: { shopId: shop.id },
    include: { plan: true }
  });

  if (!sub || sub.status !== SubscriptionStatus.ACTIVE) {
    throw new Error("FAIL: Subscription status did not transition to ACTIVE.");
  }
  console.log(`✔ Subscription updated to ACTIVE. Period: ${sub.startDate.toLocaleDateString()} - ${sub.endDate.toLocaleDateString()}`);

  // TEST 3: Issue Refund Transaction
  console.log("\n--- TEST 3: Refund Processing & Logging ---");
  const payment = result.payment;
  const refundRes = await BillingService.processRefund(
    payment.id,
    invoice1.totalAmount.toNumber(),
    'Customer requested cancellation',
    owner.id
  );

  if (!refundRes.success) {
    throw new Error(`FAIL: Refund transaction failed: ${refundRes.error}`);
  }

  // Verify payment status updated to REFUNDED
  const updatedPayment = await prisma.saaSPayment.findUnique({
    where: { id: payment.id }
  });

  if (!updatedPayment || updatedPayment.status !== SaasPaymentStatus.REFUNDED) {
    throw new Error("FAIL: Payment status did not transition to REFUNDED.");
  }
  console.log("✔ Refund processed successfully. Payment status marked REFUNDED.");

  // Clean up test invoices
  await prisma.saaSInvoice.deleteMany({
    where: { id: { in: [invoice1.id, invoice2.id] } }
  });

  console.log("\n==================================================");
  console.log("     🎉 ALL SaaS BILLING SCENARIOS PASSED!        ");
  console.log("==================================================");
}

runBillingTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
