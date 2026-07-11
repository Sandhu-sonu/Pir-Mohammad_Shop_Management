import { Role, TransactionType, CustomerLedgerType, SupplierLedgerType, BusinessType, SubscriptionStatus, BillingPeriod } from '@prisma/client';
import { prisma } from '../src/db/prisma';
import bcrypt from 'bcryptjs';

async function seedDefaultCategories(tx: any, shopId: string, businessType: BusinessType) {
  let categoriesToSeed = ['General (ਆਮ)', 'Miscellaneous (ਫੁਟਕਲ)'];
  if (businessType === BusinessType.GROCERY || businessType === BusinessType.GENERAL_STORE) {
    categoriesToSeed = [
      'Beverages (ਕੋਲਡ ਡਰਿੰਕਸ)',
      'Snacks (ਸਨੈਕਸ)',
      'Dairy (ਡੇਅਰੀ)',
      'Spices (ਮਸਾਲੇ)',
      'Grains (ਅਨਾਜ)',
      'Bakery (ਬੇਕਰੀ)'
    ];
  } else if (businessType === BusinessType.MEDICAL) {
    categoriesToSeed = [
      'Tablets (ਗੋਲੀਆਂ)',
      'Capsules (ਕੈਪਸੂਲ)',
      'Syrups (ਸਿਰਪ)',
      'Injections (ਟੀਕੇ)',
      'Ointments (ਮਲ੍ਹਮ)'
    ];
  }

  for (const catName of categoriesToSeed) {
    const existing = await tx.category.findFirst({
      where: { name: catName, shopId }
    });
    if (!existing) {
      await tx.category.create({
        data: { name: catName, shopId }
      });
    }
  }
}

async function main() {
  console.log('Starting idempotent seeding...');

  // 1. Seed System Admin Shop (Idempotent)
  const systemShopId = 'admin-system-shop-id';
  let systemShop = await prisma.shop.findUnique({
    where: { id: systemShopId }
  });

  if (!systemShop) {
    systemShop = await prisma.shop.create({
      data: {
        id: systemShopId,
        name: 'PRMS System Admin',
        address: 'System HQ',
        currency: 'INR',
        businessType: BusinessType.GENERAL_STORE
      }
    });
    console.log('Created System Admin Shop.');
  }

  // 2. Seed Super Admin User (Idempotent)
  const superAdminMobile = '9999999999';
  let superAdmin = await prisma.user.findFirst({
    where: { mobile: superAdminMobile }
  });

  if (!superAdmin) {
    const hashedPassword = await bcrypt.hash('adminpassword123', 10);
    superAdmin = await prisma.user.create({
      data: {
        name: 'System Admin',
        mobile: superAdminMobile,
        password: hashedPassword,
        role: Role.SUPER_ADMIN,
        adminRole: 'SUPER_ADMIN',
        shopId: systemShopId
      }
    });
    console.log('Created default Super Admin user (9999999999).');
  }

  // 3. Seed SaaS Features (Idempotent)
  const featuresData = [
    { code: 'INVENTORY', name: 'Inventory Management', description: 'Product listings and catalog access' },
    { code: 'CUSTOMERS', name: 'Customer Directory', description: 'Customer profiles list' },
    { code: 'KHATA', name: 'Khata Ledgers', description: 'Owed balances and ledger transactions logs' },
    { code: 'MOBILE_APP', name: 'Owner Mobile Companion', description: 'Companion app configuration for mobile' },
    { code: 'BACKUP', name: 'Database Backups', description: 'Data export and backup utilities' },
    { code: 'MULTI_USER', name: 'Multi-User Operations', description: 'Manager and cashier roles permission limits' }
  ];

  const seededFeatures: Record<string, string> = {};

  for (const feat of featuresData) {
    const existing = await prisma.feature.upsert({
      where: { code: feat.code },
      update: { name: feat.name, description: feat.description },
      create: feat
    });
    seededFeatures[feat.code] = existing.id;
  }
  console.log('Seeded platform features.');

  // 4. Seed SaaS Plans (Idempotent)
  const plansData = [
    { name: 'Basic Plan', price: 600.00, billingPeriod: BillingPeriod.MONTHLY },
    { name: 'Premium Plan', price: 1000.00, billingPeriod: BillingPeriod.MONTHLY },
    { name: 'Enterprise Plan', price: 10000.00, billingPeriod: BillingPeriod.MONTHLY }
  ];

  const seededPlans: Record<string, string> = {};

  for (const plan of plansData) {
    const existing = await prisma.plan.upsert({
      where: { name: plan.name },
      update: { price: plan.price, billingPeriod: plan.billingPeriod },
      create: {
        name: plan.name,
        price: plan.price,
        billingPeriod: plan.billingPeriod,
        isActive: true
      }
    });
    seededPlans[plan.name] = existing.id;
  }
  console.log('Seeded standard SaaS plans.');

  // 5. Seed Plan Feature Mappings (Idempotent)
  const basicPlanId = seededPlans['Basic Plan'];
  const premiumPlanId = seededPlans['Premium Plan'];
  const enterprisePlanId = seededPlans['Enterprise Plan'];

  const mappings = [
    // Basic Plan features
    { planId: basicPlanId, featureCode: 'INVENTORY', enabled: true, limitType: 'PRODUCTS', limitValue: 100 },
    { planId: basicPlanId, featureCode: 'CUSTOMERS', enabled: true, limitType: 'CUSTOMERS', limitValue: 50 },
    { planId: basicPlanId, featureCode: 'KHATA', enabled: true, limitType: 'KHATA', limitValue: 0 },
    { planId: basicPlanId, featureCode: 'MOBILE_APP', enabled: false, limitType: 'NONE', limitValue: 0 },
    { planId: basicPlanId, featureCode: 'BACKUP', enabled: false, limitType: 'BACKUPS', limitValue: 0 },
    { planId: basicPlanId, featureCode: 'MULTI_USER', enabled: false, limitType: 'USERS', limitValue: 0 },

    // Premium Plan features
    { planId: premiumPlanId, featureCode: 'INVENTORY', enabled: true, limitType: 'PRODUCTS', limitValue: 1000 },
    { planId: premiumPlanId, featureCode: 'CUSTOMERS', enabled: true, limitType: 'CUSTOMERS', limitValue: 500 },
    { planId: premiumPlanId, featureCode: 'KHATA', enabled: true, limitType: 'KHATA', limitValue: 0 },
    { planId: premiumPlanId, featureCode: 'MOBILE_APP', enabled: true, limitType: 'NONE', limitValue: 0 },
    { planId: premiumPlanId, featureCode: 'BACKUP', enabled: true, limitType: 'BACKUPS', limitValue: 5 },
    { planId: premiumPlanId, featureCode: 'MULTI_USER', enabled: true, limitType: 'USERS', limitValue: 3 },

    // Enterprise Plan features (unlimited)
    { planId: enterprisePlanId, featureCode: 'INVENTORY', enabled: true, limitType: 'PRODUCTS', limitValue: 99999 },
    { planId: enterprisePlanId, featureCode: 'CUSTOMERS', enabled: true, limitType: 'CUSTOMERS', limitValue: 99999 },
    { planId: enterprisePlanId, featureCode: 'KHATA', enabled: true, limitType: 'KHATA', limitValue: 0 },
    { planId: enterprisePlanId, featureCode: 'MOBILE_APP', enabled: true, limitType: 'NONE', limitValue: 0 },
    { planId: enterprisePlanId, featureCode: 'BACKUP', enabled: true, limitType: 'BACKUPS', limitValue: 99999 },
    { planId: enterprisePlanId, featureCode: 'MULTI_USER', enabled: true, limitType: 'USERS', limitValue: 99999 }
  ];

  for (const m of mappings) {
    const featId = seededFeatures[m.featureCode];
    if (featId) {
      await prisma.planFeature.upsert({
        where: {
          planId_featureId: {
            planId: m.planId,
            featureId: featId
          }
        },
        update: { enabled: m.enabled, limitType: m.limitType, limitValue: m.limitValue },
        create: {
          planId: m.planId,
          featureId: featId,
          enabled: m.enabled,
          limitType: m.limitType,
          limitValue: m.limitValue
        }
      });
    }
  }
  console.log('Seeded plan feature mappings.');

  // 6. Seed Demo Shop if absent (for development/testing verification)
  let demoShop = await prisma.shop.findFirst({
    where: { name: 'Sher-E-Punjab Retail' }
  });

  if (!demoShop) {
    demoShop = await prisma.shop.create({
      data: {
        name: 'Sher-E-Punjab Retail',
        address: 'G.T. Road, Jalandhar, Punjab',
        gst: '03AAAAA1111A1Z1',
        currency: 'INR'
      }
    });

    const demoOwnerPassword = await bcrypt.hash('password123', 10);
    const demoOwner = await prisma.user.create({
      data: {
        name: 'Baljinder Singh',
        mobile: '9876543210',
        password: demoOwnerPassword,
        role: Role.OWNER,
        shopId: demoShop.id
      }
    });

    await prisma.settings.create({
      data: {
        shopId: demoShop.id,
        language: 'pa',
        theme: 'light',
        lowStockAlert: true
      }
    });

    await seedDefaultCategories(prisma, demoShop.id, BusinessType.GENERAL_STORE);
    console.log('Created demo shop & owner (9876543210).');
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
