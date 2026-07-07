import React from 'react';
import { prisma } from '@/db/prisma';
import SaaSBillingManager from './SaaSBillingManager';

export default async function AdminBillingPage() {
  // 1. Fetch Invoices
  const invoices = await prisma.saaSInvoice.findMany({
    include: { 
      shop: { select: { id: true, name: true, phone: true } }, 
      payments: true, 
      refunds: true 
    },
    orderBy: { createdAt: 'desc' }
  });

  // 2. Fetch Payments
  const payments = await prisma.saaSPayment.findMany({
    include: { 
      shop: { select: { name: true } }, 
      invoice: { select: { invoiceNumber: true } } 
    },
    orderBy: { createdAt: 'desc' }
  });

  // 3. Fetch Refunds
  const refunds = await prisma.refund.findMany({
    include: { 
      payment: { select: { transactionId: true, amount: true } }, 
      invoice: { select: { invoiceNumber: true } } 
    },
    orderBy: { createdAt: 'desc' }
  });

  // 4. Fetch Transactions
  const transactions = await prisma.subscriptionTransaction.findMany({
    include: { 
      shop: { select: { name: true } }, 
      plan: { select: { name: true } } 
    },
    orderBy: { createdAt: 'desc' }
  });

  // 5. Fetch Attempts & Logs
  const attempts = await prisma.saaSPaymentAttempt.findMany({
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

  const gatewayLogs = await prisma.paymentGatewayLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30
  });

  // 6. Fetch Shops & Plans for Invoice Creation Modal
  const shops = await prisma.shop.findMany({
    where: { id: { not: 'admin-system-shop-id' } },
    select: { id: true, name: true }
  });

  const plans = await prisma.plan.findMany({
    select: { id: true, name: true, price: true }
  });

  // 7. Calculate Revenue Aggregates
  const mrrResult = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', shopId: { not: 'admin-system-shop-id' } },
    include: { plan: true }
  });
  const mrr = mrrResult.reduce((acc, sub) => acc + sub.plan.price.toNumber(), 0);
  const arr = mrr * 12;

  const totalRevenueResult = await prisma.saaSPayment.aggregate({
    _sum: { amount: true },
    where: { status: 'SUCCESS' }
  });
  const totalRevenue = totalRevenueResult._sum.amount?.toNumber() || 0;

  const outstandingResult = await prisma.saaSInvoice.aggregate({
    _sum: { totalAmount: true },
    where: { status: { in: ['PENDING', 'OVERDUE'] } }
  });
  const totalOutstanding = outstandingResult._sum.totalAmount?.toNumber() || 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">SaaS Billing & Collections / ਬਿਲਿੰਗ ਪ੍ਰਬੰਧਕ</h2>
        <p className="text-gray-400 text-sm mt-1">Manage tenant subscriptions invoices, manual renewal payments, and gateway webhooks logs</p>
      </div>

      <SaaSBillingManager
        initialInvoices={invoices.map(inv => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          shopId: inv.shopId,
          shopName: inv.shop?.name || 'N/A',
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          subtotal: inv.subtotal ? inv.subtotal.toNumber() : 0,
          taxAmount: inv.taxAmount ? inv.taxAmount.toNumber() : 0,
          totalAmount: inv.totalAmount ? inv.totalAmount.toNumber() : 0,
          status: inv.status,
          pdfUrl: inv.pdfUrl,
          notes: inv.notes
        }))}
        initialPayments={payments.map(p => ({
          id: p.id,
          invoiceNumber: p.invoice?.invoiceNumber || 'N/A',
          shopName: p.shop?.name || 'N/A',
          paymentDate: p.paymentDate,
          amount: p.amount ? p.amount.toNumber() : 0,
          paymentMethod: p.paymentMethod,
          gateway: p.gateway,
          gatewayReference: p.gatewayReference || 'N/A',
          transactionId: p.transactionId || 'N/A',
          status: p.status
        }))}
        initialRefunds={refunds.map(r => ({
          id: r.id,
          invoiceNumber: r.invoice?.invoiceNumber || 'N/A',
          originalAmount: r.payment?.amount ? r.payment.amount.toNumber() : 0,
          refundAmount: r.refundAmount ? r.refundAmount.toNumber() : 0,
          refundReason: r.refundReason || 'N/A',
          status: r.status,
          gatewayReference: r.gatewayReference || 'N/A',
          createdAt: r.createdAt
        }))}
        initialTransactions={transactions.map(t => ({
          id: t.id,
          shopName: t.shop?.name || 'N/A',
          planName: t.plan?.name || 'N/A',
          type: t.type,
          startDate: t.startDate,
          endDate: t.endDate,
          amount: t.amount ? t.amount.toNumber() : 0,
          notes: t.notes,
          createdAt: t.createdAt
        }))}
        initialAttempts={attempts.map(a => ({
          id: a.id,
          invoiceNumber: a.invoice?.invoiceNumber || 'N/A',
          shopName: a.invoice?.shop?.name || 'N/A',
          gateway: a.gateway,
          status: a.status,
          responseCode: a.responseCode || 'N/A',
          createdAt: a.createdAt
        }))}
        initialGatewayLogs={gatewayLogs.map(l => ({
          id: l.id,
          gateway: l.gateway,
          eventType: l.eventType || 'N/A',
          payload: l.payload === null || l.payload === undefined ? "" : JSON.stringify(l.payload, null, 2),
          ip: l.ip || '127.0.0.1',
          createdAt: l.createdAt
        }))}
        shops={shops}
        plans={plans.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price ? p.price.toNumber() : 0
        }))}
        mrr={mrr}
        arr={arr}
        totalRevenue={totalRevenue}
        totalOutstanding={totalOutstanding}
      />
    </div>
  );
}
