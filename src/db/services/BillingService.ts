import { prisma } from '../prisma';
import { 
  SaaSInvoiceStatus, 
  SaasPaymentStatus, 
  SubscriptionStatus, 
  SubscriptionTransactionType, 
  RefundStatus 
} from '@prisma/client';

// Part 6 - Payment Gateway Abstraction
export interface PaymentGatewayResponse {
  success: boolean;
  transactionId?: string;
  gatewayReference?: string;
  error?: string;
  rawResponse?: any;
}

export interface PaymentGatewayProvider {
  name: string;
  charge(amount: number, currency: string, metadata: any): Promise<PaymentGatewayResponse>;
  refund(transactionId: string, amount: number, reason: string): Promise<PaymentGatewayResponse>;
}

export class StripeProvider implements PaymentGatewayProvider {
  name = 'STRIPE';
  async charge(amount: number, currency: string, metadata: any): Promise<PaymentGatewayResponse> {
    return {
      success: true,
      transactionId: `ch_str_${Math.random().toString(36).substring(2, 11)}`,
      gatewayReference: `pi_str_${Math.random().toString(36).substring(2, 11)}`,
      rawResponse: { chargeStatus: 'succeeded', provider: 'StripeMock' }
    };
  }
  async refund(transactionId: string, amount: number, reason: string): Promise<PaymentGatewayResponse> {
    return {
      success: true,
      gatewayReference: `re_str_${Math.random().toString(36).substring(2, 11)}`,
      rawResponse: { refundStatus: 'succeeded' }
    };
  }
}

export class RazorpayProvider implements PaymentGatewayProvider {
  name = 'RAZORPAY';
  async charge(amount: number, currency: string, metadata: any): Promise<PaymentGatewayResponse> {
    return {
      success: true,
      transactionId: `pay_rzp_${Math.random().toString(36).substring(2, 11)}`,
      gatewayReference: `order_rzp_${Math.random().toString(36).substring(2, 11)}`,
      rawResponse: { paymentStatus: 'captured', provider: 'RazorpayMock' }
    };
  }
  async refund(transactionId: string, amount: number, reason: string): Promise<PaymentGatewayResponse> {
    return {
      success: true,
      gatewayReference: `rfnd_rzp_${Math.random().toString(36).substring(2, 11)}`,
      rawResponse: { refundStatus: 'processed' }
    };
  }
}

export class GatewayRegistry {
  private static providers: Record<string, PaymentGatewayProvider> = {
    STRIPE: new StripeProvider(),
    RAZORPAY: new RazorpayProvider(),
  };

  static getProvider(name: string): PaymentGatewayProvider {
    const provider = this.providers[name.toUpperCase()];
    if (!provider) {
      throw new Error(`Payment gateway provider '${name}' is not registered.`);
    }
    return provider;
  }
}

export class BillingService {
  /**
   * Generates a new pending invoice for a shop and its plan.
   */
  static async generateInvoice(shopId: string, planId: string, customStartDate?: Date): Promise<any> {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('Subscription plan not found');

    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new Error('Shop tenant not found');

    // 1. Generate unique invoice number: INV-[year]-[count + 1 zero padded to 6 digits]
    const currentYear = new Date().getFullYear();
    const invoiceCount = await prisma.saaSInvoice.count();
    const invoiceNumber = `INV-${currentYear}-${(invoiceCount + 1).toString().padStart(6, '0')}`;

    // 2. Set dates
    const issueDate = customStartDate || new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 7); // Default due date 7 days from issue date

    // 3. Compute totals
    const subtotal = plan.price;
    const taxRate = 0.18; // Default 18% GST standard
    const taxAmount = subtotal.toNumber() * taxRate;
    const totalAmount = subtotal.toNumber() + taxAmount;

    // Resolve subscription link if exists
    const sub = await prisma.subscription.findUnique({ where: { shopId } });

    const invoice = await prisma.saaSInvoice.create({
      data: {
        invoiceNumber,
        shopId,
        subscriptionId: sub?.id || null,
        planId,
        issueDate,
        dueDate,
        subtotal,
        taxAmount,
        totalAmount,
        currency: 'INR',
        status: SaaSInvoiceStatus.PENDING,
        notes: `Automated Invoice for ${plan.name} Tier. Billing cycle: ${plan.billingPeriod}.`
      },
      include: {
        shop: true
      }
    });

    return invoice;
  }

  /**
   * Processes a payment for an invoice and updates the tenant's subscription status.
   */
  static async processPayment(
    invoiceId: string,
    paymentMethod: string,
    gatewayName: string,
    gatewayRef?: string,
    transactionId?: string
  ): Promise<{ success: boolean; payment?: any; error?: string }> {
    try {
      const invoice = await prisma.saaSInvoice.findUnique({
        where: { id: invoiceId },
        include: { shop: { include: { subscription: true } } }
      });

      if (!invoice) return { success: false, error: 'Invoice not found' };
      if (invoice.status === SaaSInvoiceStatus.PAID) {
        return { success: false, error: 'Invoice is already paid' };
      }

      // If gateway is processed online, log attempt
      await prisma.saaSPaymentAttempt.create({
        data: {
          invoiceId,
          gateway: gatewayName,
          requestPayload: JSON.stringify({ amount: invoice.totalAmount, method: paymentMethod }),
          responsePayload: JSON.stringify({ status: 'SUCCESS', reference: gatewayRef }),
          status: 'SUCCESS'
        }
      });

      // Execute database operations in transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create SaaSPayment record
        const payment = await tx.saaSPayment.create({
          data: {
            invoiceId,
            shopId: invoice.shopId,
            amount: invoice.totalAmount,
            paymentMethod,
            gateway: gatewayName,
            gatewayReference: gatewayRef || null,
            transactionId: transactionId || `txn_${Math.random().toString(36).substring(2, 11)}`,
            status: SaasPaymentStatus.SUCCESS
          }
        });

        // 2. Update Invoice status
        await tx.saaSInvoice.update({
          where: { id: invoiceId },
          data: { status: SaaSInvoiceStatus.PAID }
        });

        // 3. Resolve Subscription updates
        const plan = await tx.plan.findUnique({
          where: { id: invoice.planId }
        });
        if (!plan) throw new Error('Invoice billing plan not found');

        const startDate = new Date();
        const endDate = new Date(startDate);
        
        if (plan.billingPeriod === 'MONTHLY') {
          endDate.setMonth(endDate.getMonth() + 1);
        } else if (plan.billingPeriod === 'YEARLY') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        } else if (plan.billingPeriod === 'LIFETIME') {
          endDate.setFullYear(endDate.getFullYear() + 50); // 50 years represent lifetime
        }

        // Upsert active subscription dates
        const existingSub = await tx.subscription.findUnique({
          where: { shopId: invoice.shopId }
        });

        if (existingSub) {
          await tx.subscription.update({
            where: { id: existingSub.id },
            data: {
              planId: plan.id,
              status: SubscriptionStatus.ACTIVE,
              startDate,
              endDate,
              updatedAt: new Date()
            }
          });
        } else {
          await tx.subscription.create({
            data: {
              shopId: invoice.shopId,
              planId: plan.id,
              status: SubscriptionStatus.ACTIVE,
              startDate,
              endDate
            }
          });
        }

        // Create transaction log
        await tx.subscriptionTransaction.create({
          data: {
            shopId: invoice.shopId,
            invoiceId,
            type: SubscriptionTransactionType.RENEWAL,
            planId: plan.id,
            startDate,
            endDate,
            amount: invoice.totalAmount,
            notes: `Successful payment processed via ${gatewayName}.`
          }
        });

        // Log in History
        await tx.subscriptionHistory.create({
          data: {
            shopId: invoice.shopId,
            planId: plan.id,
            status: SubscriptionStatus.ACTIVE,
            startDate,
            endDate,
            reason: 'Payment received'
          }
        });

        return payment;
      });

      return { success: true, payment: result };
    } catch (err: any) {
      console.error('BillingService processPayment error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Executes a refund for a successful payment.
   */
  static async processRefund(
    paymentId: string,
    amount: number,
    reason: string,
    approvedByUserId: string
  ): Promise<{ success: boolean; refund?: any; error?: string }> {
    try {
      const payment = await prisma.saaSPayment.findUnique({
        where: { id: paymentId },
        include: { invoice: true }
      });

      if (!payment) return { success: false, error: 'Payment record not found' };
      if (payment.status !== SaasPaymentStatus.SUCCESS) {
        return { success: false, error: 'Cannot refund a payment that was not successful' };
      }

      if (amount > payment.amount.toNumber()) {
        return { success: false, error: 'Refund amount cannot exceed original payment amount' };
      }

      const result = await prisma.$transaction(async (tx) => {
        // 1. Create refund record
        const refund = await tx.refund.create({
          data: {
            paymentId,
            invoiceId: payment.invoiceId,
            refundAmount: amount,
            refundReason: reason,
            approvedByUserId,
            status: RefundStatus.APPROVED,
            gatewayReference: `refnd_${Math.random().toString(36).substring(2, 11)}`
          }
        });

        // 2. Update payment status to REFUNDED
        await tx.saaSPayment.update({
          where: { id: paymentId },
          data: { status: SaasPaymentStatus.REFUNDED }
        });

        // 3. Log a refund action in subscription transactions
        const sub = await tx.subscription.findFirst({
          where: { shopId: payment.shopId }
        });
        if (sub) {
          await tx.subscriptionTransaction.create({
            data: {
              shopId: payment.shopId,
              type: SubscriptionTransactionType.CANCELLATION,
              planId: sub.planId,
              startDate: sub.startDate,
              endDate: sub.endDate,
              amount: -amount,
              notes: `Refund issued: ${reason}`
            }
          });
        }

        return refund;
      });

      return { success: true, refund: result };
    } catch (err: any) {
      console.error('BillingService processRefund error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Automatically sweeps and flags overdue invoices.
   */
  static async checkOverdueInvoices(): Promise<number> {
    try {
      const now = new Date();
      const result = await prisma.saaSInvoice.updateMany({
        where: {
          status: SaaSInvoiceStatus.PENDING,
          dueDate: { lt: now }
        },
        data: {
          status: SaaSInvoiceStatus.OVERDUE
        }
      });
      return result.count;
    } catch (err) {
      console.error('BillingService checkOverdueInvoices error:', err);
      return 0;
    }
  }
}
