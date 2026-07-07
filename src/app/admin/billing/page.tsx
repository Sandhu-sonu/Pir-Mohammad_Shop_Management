import React from 'react';
import { prisma } from '@/db/prisma';
import SaaSBillingManager from './SaaSBillingManager';

export default async function AdminBillingPage() {
  console.log("⚡ [BILLING DIAGNOSTIC] Starting page queries...");

  // 1. Fetch Invoices
  let invoices: any[] = [];
  try {
    console.log("-> Querying saas_invoices...");
    invoices = await prisma.saaSInvoice.findMany({
      include: { 
        shop: { select: { id: true, name: true, phone: true } }, 
        payments: true, 
        refunds: true 
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`<- Loaded ${invoices.length} invoices`);
  } catch (err: any) {
    console.error("❌ CRASH during saas_invoices query execution:", err.stack || err);
    throw err;
  }

  // 2. Fetch Payments
  let payments: any[] = [];
  try {
    console.log("-> Querying saas_payments...");
    payments = await prisma.saaSPayment.findMany({
      include: { 
        shop: { select: { name: true } }, 
        invoice: { select: { invoiceNumber: true } } 
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`<- Loaded ${payments.length} payments`);
  } catch (err: any) {
    console.error("❌ CRASH during saas_payments query execution:", err.stack || err);
    throw err;
  }

  // 3. Fetch Refunds
  let refunds: any[] = [];
  try {
    console.log("-> Querying saas_refunds...");
    refunds = await prisma.refund.findMany({
      include: { 
        payment: { select: { transactionId: true, amount: true } }, 
        invoice: { select: { invoiceNumber: true } } 
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`<- Loaded ${refunds.length} refunds`);
  } catch (err: any) {
    console.error("❌ CRASH during saas_refunds query execution:", err.stack || err);
    throw err;
  }

  // 4. Fetch Transactions
  let transactions: any[] = [];
  try {
    console.log("-> Querying saas_subscription_transactions...");
    transactions = await prisma.subscriptionTransaction.findMany({
      include: { 
        shop: { select: { name: true } }, 
        plan: { select: { name: true } } 
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`<- Loaded ${transactions.length} transactions`);
  } catch (err: any) {
    console.error("❌ CRASH during saas_subscription_transactions query execution:", err.stack || err);
    throw err;
  }

  // 5. Fetch Attempts & Logs
  let attempts: any[] = [];
  try {
    console.log("-> Querying saas_payment_attempts...");
    attempts = await prisma.saaSPaymentAttempt.findMany({
      include: { 
        invoice: { 
          select: { 
            invoiceNumber: true,
            shop: { select: { name: true } }
          } 
        } 
      },
      orderBy: { createdAt: 'desc' },
      take: 30
    });
    console.log(`<- Loaded ${attempts.length} attempts`);
  } catch (err: any) {
    console.error("❌ CRASH during saas_payment_attempts query execution:", err.stack || err);
    throw err;
  }

  let gatewayLogs: any[] = [];
  try {
    console.log("-> Querying payment_gateway_logs...");
    gatewayLogs = await prisma.paymentGatewayLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30
    });
    console.log(`<- Loaded ${gatewayLogs.length} gateway logs`);
  } catch (err: any) {
    console.error("❌ CRASH during payment_gateway_logs query execution:", err.stack || err);
    throw err;
  }

  // 6. Fetch Shops & Plans
  let shops: any[] = [];
  let plans: any[] = [];
  try {
    console.log("-> Querying shops and plans...");
    shops = await prisma.shop.findMany({
      where: { id: { not: 'admin-system-shop-id' } },
      select: { id: true, name: true }
    });
    plans = await prisma.plan.findMany({
      select: { id: true, name: true, price: true }
    });
    console.log(`<- Loaded ${shops.length} shops and ${plans.length} plans`);
  } catch (err: any) {
    console.error("❌ CRASH during shops/plans query execution:", err.stack || err);
    throw err;
  }

  // 7. Calculate Revenue Aggregates
  let mrr = 0;
  let arr = 0;
  let totalRevenue = 0;
  let totalOutstanding = 0;

  try {
    console.log("-> Querying subscriptions for MRR/ARR...");
    const mrrResult = await prisma.subscription.findMany({
      where: { status: 'ACTIVE', shopId: { not: 'admin-system-shop-id' } },
      include: { plan: true }
    });
    console.log(`Loaded ${mrrResult.length} active subscriptions for MRR`);
    mrr = mrrResult.reduce((acc, sub) => {
      try {
        if (!sub.plan) {
          console.warn(`[WARNING] Subscription ID ${sub.id} is missing its plan!`);
          return acc;
        }
        return acc + sub.plan.price.toNumber();
      } catch (err: any) {
        console.error(`❌ CRASH inside MRR reduce for sub ID: ${sub.id}, plan details:`, sub.plan, err);
        throw err;
      }
    }, 0);
    arr = mrr * 12;

    console.log("-> Querying SaaSPayments for total revenue...");
    const totalRevenueResult = await prisma.saaSPayment.aggregate({
      _sum: { amount: true },
      where: { status: 'SUCCESS' }
    });
    totalRevenue = totalRevenueResult._sum.amount?.toNumber() || 0;

    console.log("-> Querying SaaSInvoices for total outstanding...");
    const outstandingResult = await prisma.saaSInvoice.aggregate({
      _sum: { totalAmount: true },
      where: { status: { in: ['PENDING', 'OVERDUE'] } }
    });
    totalOutstanding = outstandingResult._sum.totalAmount?.toNumber() || 0;
    console.log("<- Aggregates calculated successfully");
  } catch (err: any) {
    console.error("❌ CRASH during aggregates calculation:", err.stack || err);
    throw err;
  }

  console.log("⚡ Starting Client props mapping...");

  let mappedInvoices: any[] = [];
  try {
    console.log("-> Mapping Invoices...");
    mappedInvoices = invoices.map((inv, idx) => {
      try {
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          shopId: inv.shopId,
          shopName: inv.shop.name,
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          subtotal: inv.subtotal.toNumber(),
          taxAmount: inv.taxAmount.toNumber(),
          totalAmount: inv.totalAmount.toNumber(),
          status: inv.status,
          pdfUrl: inv.pdfUrl,
          notes: inv.notes
        };
      } catch (err: any) {
        console.error(`❌ CRASH at Invoices mapping, index ${idx}, invoiceId: ${inv.id}`);
        console.error("Record fields:", {
          invoiceNumber: inv.invoiceNumber,
          shop: inv.shop,
          subtotal: inv.subtotal,
          totalAmount: inv.totalAmount
        });
        throw err;
      }
    });
    console.log("✔ Invoices mapped successfully");
  } catch (err: any) {
    throw err;
  }

  let mappedPayments: any[] = [];
  try {
    console.log("-> Mapping Payments...");
    mappedPayments = payments.map((p, idx) => {
      try {
        return {
          id: p.id,
          invoiceNumber: p.invoice.invoiceNumber,
          shopName: p.shop.name,
          paymentDate: p.paymentDate,
          amount: p.amount.toNumber(),
          paymentMethod: p.paymentMethod,
          gateway: p.gateway,
          gatewayReference: p.gatewayReference || 'N/A',
          transactionId: p.transactionId || 'N/A',
          status: p.status
        };
      } catch (err: any) {
        console.error(`❌ CRASH at Payments mapping, index ${idx}, paymentId: ${p.id}`);
        console.error("Record fields:", {
          invoice: p.invoice,
          shop: p.shop,
          amount: p.amount
        });
        throw err;
      }
    });
    console.log("✔ Payments mapped successfully");
  } catch (err: any) {
    throw err;
  }

  let mappedRefunds: any[] = [];
  try {
    console.log("-> Mapping Refunds...");
    mappedRefunds = refunds.map((r, idx) => {
      try {
        return {
          id: r.id,
          invoiceNumber: r.invoice.invoiceNumber,
          originalAmount: r.payment.amount.toNumber(),
          refundAmount: r.refundAmount.toNumber(),
          refundReason: r.refundReason || 'N/A',
          status: r.status,
          gatewayReference: r.gatewayReference || 'N/A',
          createdAt: r.createdAt
        };
      } catch (err: any) {
        console.error(`❌ CRASH at Refunds mapping, index ${idx}, refundId: ${r.id}`);
        console.error("Record fields:", {
          invoice: r.invoice,
          payment: r.payment,
          refundAmount: r.refundAmount
        });
        throw err;
      }
    });
    console.log("✔ Refunds mapped successfully");
  } catch (err: any) {
    throw err;
  }

  let mappedTransactions: any[] = [];
  try {
    console.log("-> Mapping Transactions...");
    mappedTransactions = transactions.map((t, idx) => {
      try {
        return {
          id: t.id,
          shopName: t.shop.name,
          planName: t.plan.name,
          type: t.type,
          startDate: t.startDate,
          endDate: t.endDate,
          amount: t.amount.toNumber(),
          notes: t.notes,
          createdAt: t.createdAt
        };
      } catch (err: any) {
        console.error(`❌ CRASH at Transactions mapping, index ${idx}, txnId: ${t.id}`);
        console.error("Record fields:", {
          shop: t.shop,
          plan: t.plan,
          amount: t.amount
        });
        throw err;
      }
    });
    console.log("✔ Transactions mapped successfully");
  } catch (err: any) {
    throw err;
  }

  let mappedAttempts: any[] = [];
  try {
    console.log("-> Mapping Attempts...");
    mappedAttempts = attempts.map((a, idx) => {
      try {
        return {
          id: a.id,
          invoiceNumber: a.invoice.invoiceNumber,
          shopName: a.invoice.shop.name,
          gateway: a.gateway,
          status: a.status,
          responseCode: a.responseCode || 'N/A',
          createdAt: a.createdAt
        };
      } catch (err: any) {
        console.error(`❌ CRASH at Attempts mapping, index ${idx}, attemptId: ${a.id}`);
        console.error("Record fields:", {
          invoice: a.invoice
        });
        throw err;
      }
    });
    console.log("✔ Payment attempts mapped successfully");
  } catch (err: any) {
    throw err;
  }

  let mappedGatewayLogs: any[] = [];
  try {
    console.log("-> Mapping Gateway Logs...");
    mappedGatewayLogs = gatewayLogs.map((l, idx) => {
      try {
        return {
          id: l.id,
          gateway: l.gateway,
          eventType: l.eventType || 'N/A',
          payload: l.payload === null || l.payload === undefined ? "" : JSON.stringify(l.payload, null, 2),
          ip: l.ip || '127.0.0.1',
          createdAt: l.createdAt
        };
      } catch (err: any) {
        console.error(`❌ CRASH at Gateway Logs mapping, index ${idx}, logId: ${l.id}`);
        throw err;
      }
    });
    console.log("✔ Gateway logs mapped successfully");
  } catch (err: any) {
    throw err;
  }

  let mappedPlans: any[] = [];
  try {
    console.log("-> Mapping Plans...");
    mappedPlans = plans.map((p, idx) => {
      try {
        return {
          id: p.id,
          name: p.name,
          price: p.price.toNumber()
        };
      } catch (err: any) {
        console.error(`❌ CRASH at Plans mapping, index ${idx}, planId: ${p.id}`);
        throw err;
      }
    });
    console.log("✔ Plans mapped successfully");
  } catch (err: any) {
    throw err;
  }

  console.log("✔ All client props mapped successfully without crash!");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">SaaS Billing & Collections / ਬਿਲਿੰਗ ਪ੍ਰਬੰਧਕ</h2>
        <p className="text-gray-400 text-sm mt-1">Manage tenant subscriptions invoices, manual renewal payments, and gateway webhooks logs</p>
      </div>

      <SaaSBillingManager
        initialInvoices={mappedInvoices}
        initialPayments={mappedPayments}
        initialRefunds={mappedRefunds}
        initialTransactions={mappedTransactions}
        initialAttempts={mappedAttempts}
        initialGatewayLogs={mappedGatewayLogs}
        shops={shops}
        plans={mappedPlans}
        mrr={mrr}
        arr={arr}
        totalRevenue={totalRevenue}
        totalOutstanding={totalOutstanding}
      />
    </div>
  );
}
