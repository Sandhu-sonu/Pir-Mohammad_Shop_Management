import { NextResponse } from 'next/server';
import { prisma } from '@/db/prisma';
import { BillingService } from '@/db/services/BillingService';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    
    // Log the webhook payload
    await prisma.paymentGatewayLog.create({
      data: {
        gateway: payload.gateway || 'UNKNOWN',
        eventType: payload.event || 'payment.succeeded',
        payload: JSON.stringify(payload),
        ip: req.headers.get('x-forwarded-for') || '127.0.0.1'
      }
    });

    // Handle payment succeeded hook: requires invoiceId
    if (payload.event === 'payment.succeeded' && payload.invoiceId) {
      const result = await BillingService.processPayment(
        payload.invoiceId,
        payload.paymentMethod || 'CARD',
        payload.gateway || 'MOCK',
        payload.gatewayReference || `ref_${Date.now()}`,
        payload.transactionId || `txn_${Date.now()}`
      );
      
      if (result.success) {
        return NextResponse.json({ success: true, message: 'Payment captured and subscription activated.' });
      } else {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, message: 'Webhook event processed.' });
  } catch (err: any) {
    console.error('SaaS Webhook processing failure:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
