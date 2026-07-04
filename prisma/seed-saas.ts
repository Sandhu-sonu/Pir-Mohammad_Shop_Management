import 'dotenv/config';
import { Role, AdminRole, BillingPeriod, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../src/db/prisma';
import * as bcrypt from 'bcryptjs';

async function main() {
  console.log('=== SEEDING SAAS FEATURES AND PLANS ===');

  // 1. Create Features
  const featuresData = [
    { code: 'MOBILE_APP', name: 'Mobile Application Access', description: 'Access the PRMS Owner App on iOS & Android' },
    { code: 'ADVANCED_REPORTS', name: 'Advanced Reports', description: 'Access granular daily, monthly, profit, and top charts' },
    { code: 'MULTI_USER', name: 'Multi-User Support', description: 'Create additional manager, staff, and view-only roles' },
    { code: 'BACKUP', name: 'Database Backups', description: 'Create manual and auto-scheduled database backups' },
    { code: 'AI_REPORTS', name: 'AI Report Summaries', description: 'Generate AI sales predictions and summaries' },
    { code: 'MULTI_BRANCH', name: 'Multi-Branch Management', description: 'Link multiple branch store locations' },
  ];

  const features: any = {};
  for (const f of featuresData) {
    features[f.code] = await prisma.feature.upsert({
      where: { code: f.code },
      update: { name: f.name, description: f.description },
      create: f
    });
    console.log(`Upserted Feature: ${f.code}`);
  }

  // 2. Create Plans
  const plansData = [
    { name: 'Basic Plan', price: 499, billingPeriod: BillingPeriod.MONTHLY },
    { name: 'Premium Plan', price: 999, billingPeriod: BillingPeriod.MONTHLY },
    { name: 'Enterprise Plan', price: 2999, billingPeriod: BillingPeriod.MONTHLY },
  ];

  const plans: any = {};
  for (const p of plansData) {
    plans[p.name] = await prisma.plan.upsert({
      where: { name: p.name },
      update: { price: p.price, billingPeriod: p.billingPeriod },
      create: p
    });
    console.log(`Upserted Plan: ${p.name}`);
  }

  // 3. Connect Plan Features
  console.log('Configuring Plan Feature permissions & limits...');

  // Basic Plan limits
  const basicMappings = [
    { featureCode: 'MOBILE_APP', enabled: true, limitType: 'ACCESS', limitValue: 1 },
    { featureCode: 'ADVANCED_REPORTS', enabled: true, limitType: 'ACCESS', limitValue: 1 },
    { featureCode: 'MULTI_USER', enabled: true, limitType: 'USERS', limitValue: 2 },
    { featureCode: 'BACKUP', enabled: true, limitType: 'BACKUPS', limitValue: 30 },
    { featureCode: 'AI_REPORTS', enabled: false, limitType: 'ACCESS', limitValue: 0 },
    { featureCode: 'MULTI_BRANCH', enabled: false, limitType: 'ACCESS', limitValue: 0 },
  ];

  // Premium Plan limits
  const premiumMappings = [
    { featureCode: 'MOBILE_APP', enabled: true, limitType: 'ACCESS', limitValue: 1 },
    { featureCode: 'ADVANCED_REPORTS', enabled: true, limitType: 'ACCESS', limitValue: 1 },
    { featureCode: 'MULTI_USER', enabled: true, limitType: 'USERS', limitValue: 10 },
    { featureCode: 'BACKUP', enabled: true, limitType: 'BACKUPS', limitValue: 100 },
    { featureCode: 'AI_REPORTS', enabled: false, limitType: 'ACCESS', limitValue: 0 },
    { featureCode: 'MULTI_BRANCH', enabled: true, limitType: 'BRANCHES', limitValue: 3 },
  ];

  // Enterprise Plan limits
  const enterpriseMappings = [
    { featureCode: 'MOBILE_APP', enabled: true, limitType: 'ACCESS', limitValue: 1 },
    { featureCode: 'ADVANCED_REPORTS', enabled: true, limitType: 'ACCESS', limitValue: 1 },
    { featureCode: 'MULTI_USER', enabled: true, limitType: 'USERS', limitValue: 999 },
    { featureCode: 'BACKUP', enabled: true, limitType: 'BACKUPS', limitValue: 999 },
    { featureCode: 'AI_REPORTS', enabled: true, limitType: 'ACCESS', limitValue: 1 },
    { featureCode: 'MULTI_BRANCH', enabled: true, limitType: 'BRANCHES', limitValue: 999 },
  ];

  const mapFeatures = async (planId: string, mappings: any[]) => {
    for (const m of mappings) {
      const feat = features[m.featureCode];
      await prisma.planFeature.upsert({
        where: {
          planId_featureId: {
            planId,
            featureId: feat.id
          }
        },
        update: { enabled: m.enabled, limitType: m.limitType, limitValue: m.limitValue },
        create: {
          planId,
          featureId: feat.id,
          enabled: m.enabled,
          limitType: m.limitType,
          limitValue: m.limitValue
        }
      });
    }
  };

  await mapFeatures(plans['Basic Plan'].id, basicMappings);
  await mapFeatures(plans['Premium Plan'].id, premiumMappings);
  await mapFeatures(plans['Enterprise Plan'].id, enterpriseMappings);

  // 4. Create System Admin Shop
  const adminShopId = 'admin-system-shop-id';
  const adminShop = await prisma.shop.upsert({
    where: { id: adminShopId },
    update: {},
    create: {
      id: adminShopId,
      name: 'PRMS System Admin',
      address: 'System HQ',
      currency: 'INR'
    }
  });
  console.log('Seeded System Admin Shop context.');

  // Create active subscription for Admin Shop to keep schema constraints clean
  await prisma.subscription.upsert({
    where: { shopId: adminShopId },
    update: {},
    create: {
      shopId: adminShopId,
      planId: plans['Enterprise Plan'].id,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(),
      endDate: new Date(new Date().getFullYear() + 10, 1, 1)
    }
  });

  // 5. Create Super Admin User
  const adminMobile = '9999999999';
  const hashedPassword = await bcrypt.hash('adminpassword123', 10);
  await prisma.user.upsert({
    where: { mobile: adminMobile },
    update: { password: hashedPassword },
    create: {
      mobile: adminMobile,
      name: 'Super Admin',
      password: hashedPassword,
      role: Role.SUPER_ADMIN,
      adminRole: AdminRole.SUPER_ADMIN,
      shopId: adminShopId
    }
  });
  console.log('Seeded Super Admin user (Mobile: 9999999999, Pass: adminpassword123).');

  console.log('=== SEEDING COMPLETED SUCCESSFULLY ===');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
