/*
  Warnings:

  - You are about to drop the column `invoicePrefix` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `printerWidth` on the `settings` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ReceiptFormat" AS ENUM ('SIMPLE', 'DETAILED');

-- CreateEnum
CREATE TYPE "PrinterType" AS ENUM ('THERMAL_58', 'THERMAL_80', 'A4');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('FIXED', 'PERCENT');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT', 'BILLING', 'SALES', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'YEARLY', 'LIFETIME');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SaaSInvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SaasPaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SubscriptionTransactionType" AS ENUM ('UPGRADE', 'DOWNGRADE', 'RENEWAL', 'TRIAL_EXTENSION', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FAILED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_userId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminRole" "AdminRole",
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "failedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "mobileVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "shopId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "discountReason" TEXT,
ADD COLUMN     "discountType" "DiscountType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "itemDiscount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "originalPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "billDiscount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "billDiscountType" "DiscountType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "discountReason" TEXT;

-- AlterTable
ALTER TABLE "settings" DROP COLUMN "invoicePrefix",
DROP COLUMN "printerWidth",
ADD COLUMN     "allowBillDiscount" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowItemDiscount" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoSuggestEnglish" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoSuggestPunjabi" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxStaffDiscount" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
ADD COLUMN     "minPasswordLength" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "printerType" "PrinterType" NOT NULL DEFAULT 'THERMAL_80',
ADD COLUMN     "reasonAmountLimit" DECIMAL(10,2) NOT NULL DEFAULT 500.00,
ADD COLUMN     "reasonPercentLimit" DECIMAL(5,2) NOT NULL DEFAULT 15.00,
ADD COLUMN     "receiptFormat" "ReceiptFormat" NOT NULL DEFAULT 'SIMPLE',
ADD COLUMN     "receiptPrefix" TEXT NOT NULL DEFAULT 'RCP-',
ADD COLUMN     "requireDiscountReason" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requirePasswordNumber" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requirePasswordSpecial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requirePasswordUppercase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxPrefix" TEXT NOT NULL DEFAULT 'INV-';

-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "gstRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSuspended" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "features" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_features" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "limitType" TEXT NOT NULL,
    "limitValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_history" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "changedByUserId" TEXT,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'LOW',
    "assignedToUserId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_versions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "minimumMobileVersion" TEXT NOT NULL,
    "forceUpdate" BOOLEAN NOT NULL DEFAULT false,
    "releaseNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "planId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "SaaSInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "pdfUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "gatewayReference" TEXT,
    "transactionId" TEXT,
    "status" "SaasPaymentStatus" NOT NULL DEFAULT 'SUCCESS',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_payment_attempts" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "requestPayload" TEXT,
    "responsePayload" TEXT,
    "responseCode" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saas_payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_subscription_transactions" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "type" "SubscriptionTransactionType" NOT NULL,
    "planId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "changedByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saas_subscription_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_refunds" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "refundAmount" DECIMAL(10,2) NOT NULL,
    "refundReason" TEXT,
    "approvedByUserId" TEXT,
    "gatewayReference" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_gateway_logs" (
    "id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "eventType" TEXT,
    "payload" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_gateway_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "features_code_key" ON "features"("code");

-- CreateIndex
CREATE UNIQUE INDEX "plan_features_planId_featureId_key" ON "plan_features"("planId", "featureId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_shopId_key" ON "subscriptions"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "app_versions_version_key" ON "app_versions"("version");

-- CreateIndex
CREATE UNIQUE INDEX "saas_invoices_invoiceNumber_key" ON "saas_invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "saas_invoices_shopId_idx" ON "saas_invoices"("shopId");

-- CreateIndex
CREATE INDEX "saas_invoices_subscriptionId_idx" ON "saas_invoices"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "saas_payments_transactionId_key" ON "saas_payments"("transactionId");

-- CreateIndex
CREATE INDEX "saas_payments_invoiceId_idx" ON "saas_payments"("invoiceId");

-- CreateIndex
CREATE INDEX "saas_payments_shopId_idx" ON "saas_payments"("shopId");

-- CreateIndex
CREATE INDEX "saas_payment_attempts_invoiceId_idx" ON "saas_payment_attempts"("invoiceId");

-- CreateIndex
CREATE INDEX "saas_subscription_transactions_shopId_idx" ON "saas_subscription_transactions"("shopId");

-- CreateIndex
CREATE INDEX "saas_subscription_transactions_invoiceId_idx" ON "saas_subscription_transactions"("invoiceId");

-- CreateIndex
CREATE INDEX "saas_refunds_paymentId_idx" ON "saas_refunds"("paymentId");

-- CreateIndex
CREATE INDEX "saas_refunds_invoiceId_idx" ON "saas_refunds"("invoiceId");

-- CreateIndex
CREATE INDEX "audit_logs_shopId_idx" ON "audit_logs"("shopId");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_payments" ADD CONSTRAINT "saas_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "saas_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_payments" ADD CONSTRAINT "saas_payments_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_payment_attempts" ADD CONSTRAINT "saas_payment_attempts_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "saas_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscription_transactions" ADD CONSTRAINT "saas_subscription_transactions_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscription_transactions" ADD CONSTRAINT "saas_subscription_transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "saas_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscription_transactions" ADD CONSTRAINT "saas_subscription_transactions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscription_transactions" ADD CONSTRAINT "saas_subscription_transactions_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_refunds" ADD CONSTRAINT "saas_refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "saas_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_refunds" ADD CONSTRAINT "saas_refunds_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "saas_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_refunds" ADD CONSTRAINT "saas_refunds_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
