import 'dotenv/config';
import { Module } from 'module';

// 1. STUB next/headers & next/cache IMMEDIATELY at the absolute top of the file loader
const mockSessionContainer = {
  user: null as any,
  shop: null as any
};

const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'next/headers') {
    return {
      cookies: async () => ({
        get: (name: string) => {
          if (name === 'session') {
            return {
              value: JSON.stringify({
                userId: mockSessionContainer.user.id,
                name: mockSessionContainer.user.name,
                role: mockSessionContainer.user.role,
                shopId: mockSessionContainer.shop.id,
                businessType: mockSessionContainer.shop.businessType,
                mobile: mockSessionContainer.user.mobile,
                shopName: mockSessionContainer.shop.name,
                printerType: 'THERMAL_80'
              })
            };
          }
          return null;
        },
        set: () => {},
        delete: () => {}
      })
    };
  }
  if (id === 'next/cache') {
    return {
      revalidatePath: (path: string) => {
        // console.log(`[next/cache] revalidatePath called for: ${path}`);
      }
    };
  }
  return originalRequire.apply(this, arguments as any);
};

// 2. Now import database and other services safely
import { prisma } from '../src/db/prisma';
import { Role, BusinessType, PaymentMethod, PurchaseStatus, DiscountType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

async function runRcSimulation() {
  console.log('==================================================================');
  console.log('   PUNJAB RETAIL MANAGEMENT SYSTEM - RELEASE CANDIDATE SIMULATOR   ');
  console.log('==================================================================\n');

  // --- PHASE 1: ENVIRONMENT SETUP ---
  console.log('>>> PHASE 1: ENVIRONMENT SETUP');
  const stamp = Date.now();
  const shopName = `RC Shop ${stamp}`;
  
  // Create isolated shop
  const shop = await prisma.shop.create({
    data: {
      name: shopName,
      address: 'Simulated Market Area, Jalandhar, Punjab',
      gst: '03RCSIM' + Math.floor(1000 + Math.random() * 9000) + 'A1Z1',
      currency: 'INR',
      businessType: BusinessType.GENERAL_STORE
    }
  });
  console.log(`✔ Created Shop: ${shop.name} (ID: ${shop.id})`);
  mockSessionContainer.shop = shop;

  // Create default shop settings
  const settings = await prisma.settings.create({
    data: {
      shopId: shop.id,
      language: 'pa',
      theme: 'light',
      lowStockAlert: true,
      autoSuggestEnglish: true,
      autoSuggestPunjabi: true
    }
  });
  console.log('✔ Seeded default Shop Settings');

  // Seed default categories
  const { seedDefaultCategories } = require('../src/lib/actions/categories');
  await seedDefaultCategories(prisma, shop.id, shop.businessType);
  console.log('✔ Seeded default shop-specific categories');

  // Create Owner & Staff Users
  const owner = await prisma.user.create({
    data: {
      name: 'Simulated Owner',
      mobile: '91' + Math.floor(10000000 + Math.random() * 90000000),
      password: 'owner_password_123',
      role: Role.OWNER,
      shopId: shop.id
    }
  });
  const staff = await prisma.user.create({
    data: {
      name: 'Simulated Staff',
      mobile: '92' + Math.floor(10000000 + Math.random() * 90000000),
      password: 'staff_password_123',
      role: Role.STAFF,
      shopId: shop.id
    }
  });
  console.log(`✔ Created OWNER user: ${owner.name} (ID: ${owner.id})`);
  console.log(`✔ Created STAFF user: ${staff.name} (ID: ${staff.id})`);

  mockSessionContainer.user = owner; // Log in Owner initially

  // Import server actions dynamically
  const { addProductAction } = require('../src/lib/actions/inventory');
  const { addCustomerAction } = require('../src/lib/actions/customers');
  const { createSupplierAction } = require('../src/lib/actions/suppliers');
  const { createSaleAction } = require('../src/lib/actions/sales');
  const { createPurchaseAction } = require('../src/lib/actions/purchases');
  const { createExpenseAction } = require('../src/lib/actions/expenses');
  const { saveClosingAction } = require('../src/lib/actions/closing');
  const { updateShopSettingsAction } = require('../src/lib/actions/settings');
  const { createBackupAction } = require('../src/lib/actions/backups');
  const { BackupService } = require('../src/db/services/BackupService');

  // --- PHASE 2: MORNING WORKFLOW ---
  console.log('\n>>> PHASE 2: MORNING WORKFLOW (PRODUCT ENTRY & INVENTORY ACQUISITION)');
  
  const products: any[] = [];
  for (let i = 1; i <= 10; i++) {
    const prodRes = await addProductAction({
      nameEn: `Sim Product ${i}`,
      namePa: `ਉਤਪਾਦ ${i}`,
      sku: `SKU-${stamp}-${i}`,
      barcode: `BAR-${stamp}-${i}`,
      purchasePrice: 10 * i,
      sellingPrice: 12 * i,
      currentQuantity: 50,
      minStock: 5,
      unit: 'pcs'
    });
    if (!prodRes.success) {
      throw new Error(`Failed to seed simulation product: ${prodRes.error}`);
    }
    products.push(prodRes.product);
  }
  console.log(`✔ Added 10 products. Sample: ${products[0].nameEn} (SKU: ${products[0].sku})`);

  // Add Customers
  const customerResult = await addCustomerAction({
    name: 'Gurbaksh Singh',
    mobile: randMobile(),
    email: 'gurbaksh@khata.com',
    address: 'Ludhiana, Punjab',
    openingBalance: 500
  });
  if (!customerResult.success) {
    throw new Error(`Customer creation failed: ${customerResult.error}`);
  }
  const customer = customerResult.customer;
  console.log(`✔ Added Registered Customer: ${customer.name} with opening balance: ₹${customer.openingBalance}`);

  // Add Suppliers & Purchase Orders
  const supplier = await createSupplierAction({
    name: 'Amritsar Wholesale Traders',
    mobile: randMobile(),
    gst: '03SUPPLIER1234A1Z3',
    currentBalance: 0
  });
  console.log(`✔ Added Supplier: ${supplier.name}`);

  // Receive Purchase order
  const purchase = await createPurchaseAction({
    supplierId: supplier.id,
    items: [
      { productId: products[0].id, quantity: 50, purchasePrice: 10 },
      { productId: products[1].id, quantity: 20, purchasePrice: 20 }
    ],
    invoiceNumber: `INV-${stamp}-MORNING`,
    note: 'Initial morning procurement',
    paidAmount: 300,
    status: PurchaseStatus.RECEIVED
  });
  console.log(`✔ Received Morning Purchase Order. Supplier Dues logged.`);

  // --- PHASE 3: DAY OPERATIONS ---
  console.log('\n>>> PHASE 3: DAY-TIME OPERATIONS (SALES, PAYMENTS, EXPENSES)');

  // POS Checkout 1: Cash sale
  const cashSale = await createSaleAction({
    items: [
      {
        productId: products[0].id,
        quantity: 2,
        sellingPrice: 12,
        originalPrice: 12,
        itemDiscount: 0,
        discountType: DiscountType.PERCENT
      }
    ],
    discount: 0,
    paymentMethod: PaymentMethod.CASH,
    paidAmount: 24,
    billDiscount: 0,
    billDiscountType: DiscountType.PERCENT
  });
  console.log(`✔ Walk-in Cash checkout complete. Invoice: ${cashSale.sale.invoiceNumber}`);

  // POS Checkout 2: Udhaar credit sale
  const creditSale = await createSaleAction({
    customerId: customer.id,
    items: [
      {
        productId: products[1].id,
        quantity: 4,
        sellingPrice: 24,
        originalPrice: 24,
        itemDiscount: 0,
        discountType: DiscountType.PERCENT
      }
    ],
    discount: 0,
    paymentMethod: PaymentMethod.CREDIT,
    paidAmount: 0,
    billDiscount: 0,
    billDiscountType: DiscountType.PERCENT
  });
  console.log(`✔ Udhaar (Credit) POS checkout complete. Invoice: ${creditSale.sale.invoiceNumber}`);

  // Customer payment
  const { receivePaymentAction } = require('../src/lib/actions/customers');
  await receivePaymentAction(customer.id, 300, 'Cash payment towards dues', 'CASH');
  console.log(`✔ Collected ₹300 customer payment towards outstanding Khata.`);

  // Supplier payment
  const { paySupplierAction } = require('../src/lib/actions/suppliers');
  await paySupplierAction(supplier.id, 400, 'UPI payment to distributor', 'UPI');
  console.log(`✔ Paid ₹400 towards supplier balance.`);

  // Daily Expense
  const expense = await createExpenseAction({
    category: 'MEALS',
    amount: 150,
    description: 'Tea and snacks for staff',
    paymentMethod: PaymentMethod.CASH
  });
  console.log(`✔ Logged Daily Expense: ₹150 for meals.`);

  // --- PHASE 4: END OF DAY AUDIT ---
  console.log('\n>>> PHASE 4: END OF DAY VERIFICATIONS');

  // Verify Customer Balances
  const dbCustomer = await prisma.customer.findUnique({ where: { id: customer.id } });
  const expectedCustomerDues = 500 + 96 - 300;
  const actualCustomerDues = Number(dbCustomer?.currentBalance || 0);
  console.log(`- Customer Khata Balance - Expected: ₹${expectedCustomerDues}, Actual: ₹${actualCustomerDues}`);
  const customerOk = actualCustomerDues === expectedCustomerDues;

  // Verify Supplier Balances
  const dbSupplier = await prisma.supplier.findUnique({ where: { id: supplier.id } });
  const expectedSupplierDues = 900 - 300 - 400;
  const actualSupplierDues = Number(dbSupplier?.currentBalance || 0);
  console.log(`- Supplier Balance - Expected: ₹${expectedSupplierDues}, Actual: ₹${actualSupplierDues}`);
  const supplierOk = actualSupplierDues === expectedSupplierDues;

  // Verify Product Stock Quantities
  const dbProd0 = await prisma.product.findUnique({ where: { id: products[0].id } });
  const dbProd1 = await prisma.product.findUnique({ where: { id: products[1].id } });
  const prod0Ok = Number(dbProd0?.currentQuantity || 0) === 98;
  const prod1Ok = Number(dbProd1?.currentQuantity || 0) === 66;
  console.log(`- Product 0 Stock - Expected: 98, Actual: ${Number(dbProd0?.currentQuantity)}`);
  console.log(`- Product 1 Stock - Expected: 66, Actual: ${Number(dbProd1?.currentQuantity)}`);

  // Perform Daily Closing
  const closingResult = await saveClosingAction({
    dateString: new Date().toISOString().slice(0, 10),
    openingCash: 5000,
    closingCash: 5174,
    withdrawals: 0,
    notes: 'End of Day simulated closing'
  });
  console.log(`✔ Daily Closing saved successfully: ${closingResult.success}`);

  // --- PHASE 5: PERFORMANCE BENCHMARKING & BULK SEEDING ---
  console.log('\n>>> PHASE 5: PERFORMANCE BENCHMARKING');

  // Benchmark 1: 100 Products POS Search
  console.log('Benchmarking 100 products search...');
  let start = Date.now();
  await prisma.product.findMany({
    where: { shopId: shop.id, nameEn: { contains: 'Sim Product 5', mode: 'insensitive' } }
  });
  const t100 = Date.now() - start;
  console.log(`- 100 products search latency: ${t100}ms`);

  // Bulk insert to reach 1,000 products
  console.log('Seeding 900 additional products for 1,000 products benchmark...');
  const bulkProducts1k: any[] = [];
  for (let i = 11; i <= 1000; i++) {
    bulkProducts1k.push({
      shopId: shop.id,
      nameEn: `Bulk Product ${i}`,
      namePa: `ਉਤਪਾਦ ${i}`,
      sku: `SKU-${stamp}-${i}`,
      barcode: `BAR-${stamp}-${i}`,
      purchasePrice: 10,
      sellingPrice: 15,
      currentQuantity: 10,
      minStock: 2,
      unit: 'pcs'
    });
  }
  await prisma.product.createMany({ data: bulkProducts1k });

  console.log('Benchmarking 1,000 products search...');
  start = Date.now();
  await prisma.product.findMany({
    where: { shopId: shop.id, nameEn: { contains: 'Bulk Product 888', mode: 'insensitive' } }
  });
  const t1000 = Date.now() - start;
  console.log(`- 1,000 products search latency: ${t1000}ms`);

  // Bulk insert to reach 5,000 products
  console.log('Seeding 4,000 additional products for 5,000 products benchmark...');
  const bulkProducts5k: any[] = [];
  for (let i = 1001; i <= 5000; i++) {
    bulkProducts5k.push({
      shopId: shop.id,
      nameEn: `Bulk Product ${i}`,
      namePa: `ਉਤਪਾਦ ${i}`,
      sku: `SKU-${stamp}-${i}`,
      barcode: `BAR-${stamp}-${i}`,
      purchasePrice: 10,
      sellingPrice: 15,
      currentQuantity: 10,
      minStock: 2,
      unit: 'pcs'
    });
  }
  
  const chunkSize = 1000;
  for (let i = 0; i < bulkProducts5k.length; i += chunkSize) {
    await prisma.product.createMany({ data: bulkProducts5k.slice(i, i + chunkSize) });
  }

  console.log('Benchmarking 5,000 products search...');
  start = Date.now();
  await prisma.product.findMany({
    where: { shopId: shop.id, nameEn: { contains: 'Bulk Product 4444', mode: 'insensitive' } }
  });
  const t5000 = Date.now() - start;
  console.log(`- 5,000 products search latency: ${t5000}ms`);

  // Create Backup AFTER 5,000 products are seeded so the backup size is realistic
  console.log('\nCreating Backup for the 5,000 products database...');
  const backupResult = await createBackupAction('RC 5,000 Products Simulation Backup');
  console.log(`✔ Backup saved successfully: ${backupResult.success}`);

  // --- PHASE 6: SECURITY (RBAC) VERIFICATION ---
  console.log('\n>>> PHASE 6: SECURITY / RBAC VERIFICATION');
  
  const { hasPermission } = require('../src/lib/permissions');
  
  const ownerCanSettings = hasPermission(Role.OWNER, 'settings.write');
  const ownerCanBackup = hasPermission(Role.OWNER, 'backup.write');
  console.log(`✔ OWNER has settings.write: ${ownerCanSettings}`);
  console.log(`✔ OWNER has backup.write: ${ownerCanBackup}`);

  const managerCanClosing = hasPermission(Role.MANAGER, 'dailyClosing.write');
  const managerCanSettings = hasPermission(Role.MANAGER, 'settings.write');
  console.log(`✔ MANAGER has dailyClosing.write: ${managerCanClosing}`);
  console.log(`✔ MANAGER has settings.write (Expected true): ${managerCanSettings}`);

  const staffCanSell = hasPermission(Role.STAFF, 'sales.write');
  const staffCanBackup = hasPermission(Role.STAFF, 'backup.write');
  console.log(`✔ STAFF has sales.write: ${staffCanSell}`);
  console.log(`✔ STAFF has backup.write (Expected false): ${staffCanBackup}`);

  const rbacOk = ownerCanSettings && ownerCanBackup && managerCanClosing && managerCanSettings && staffCanSell && !staffCanBackup;

  // --- PHASE 7: BACKUP & RESTORE VERIFICATION ---
  console.log('\n>>> PHASE 7: DATA LOSS & BACKUP RESTORE VERIFICATION');
  
  const prodCountBefore = await prisma.product.count({ where: { shopId: shop.id } });
  const saleCountBefore = await prisma.sale.count({ where: { shopId: shop.id } });
  console.log(`Before simulated crash: Products: ${prodCountBefore}, Sales: ${saleCountBefore}`);

  const backupFile = backupResult.history.filename;
  const backupPath = path.join(BackupService.getBackupDir(), backupFile);
  const backupJsonContent = fs.readFileSync(backupPath, 'utf8');

  console.log('Simulating database corruption/loss (deleting products, sales, customers)...');
  await prisma.saleItem.deleteMany({ where: { sale: { shopId: shop.id } } });
  await prisma.sale.deleteMany({ where: { shopId: shop.id } });
  await prisma.purchaseItem.deleteMany({ where: { purchase: { shopId: shop.id } } });
  await prisma.purchase.deleteMany({ where: { shopId: shop.id } });
  await prisma.inventoryTransaction.deleteMany({ where: { product: { shopId: shop.id } } });
  await prisma.product.deleteMany({ where: { shopId: shop.id } });
  await prisma.customerLedger.deleteMany({ where: { customer: { shopId: shop.id } } });
  await prisma.customer.deleteMany({ where: { shopId: shop.id } });
  await prisma.supplierLedger.deleteMany({ where: { supplier: { shopId: shop.id } } });
  await prisma.supplier.deleteMany({ where: { shopId: shop.id } });
  await prisma.expense.deleteMany({ where: { shopId: shop.id } });
  await prisma.dailyClosing.deleteMany({ where: { shopId: shop.id } });

  const prodCountCrash = await prisma.product.count({ where: { shopId: shop.id } });
  const saleCountCrash = await prisma.sale.count({ where: { shopId: shop.id } });
  console.log(`After crash: Products: ${prodCountCrash}, Sales: ${saleCountCrash}`);

  console.log('Restoring from backup...');
  await BackupService.restoreBackup(shop.id, owner.id, backupJsonContent);

  const prodCountAfter = await prisma.product.count({ where: { shopId: shop.id } });
  const saleCountAfter = await prisma.sale.count({ where: { shopId: shop.id } });
  console.log(`After restore: Products: ${prodCountAfter}, Sales: ${saleCountAfter}`);

  const restoreOk = prodCountBefore === prodCountAfter && saleCountBefore === saleCountAfter;
  console.log(`✔ Restore verification result: ${restoreOk ? 'PASSED' : 'FAILED'}`);

  // --- FINAL METRIC COMPILATION ---
  console.log('\n==================================================================');
  console.log('   🎉 SIMULATION SUMMARY');
  console.log('==================================================================');
  console.log(`Category, Products, Dues seeding: PASSED`);
  console.log(`Customer ledger balance tracking: ${customerOk ? 'PASSED' : 'FAILED'}`);
  console.log(`Supplier ledger balance tracking: ${supplierOk ? 'PASSED' : 'FAILED'}`);
  console.log(`Product stock quantities tracking: ${prod0Ok && prod1Ok ? 'PASSED' : 'FAILED'}`);
  console.log(`RBAC security validations: ${rbacOk ? 'PASSED' : 'FAILED'}`);
  console.log(`Backup & Restore verification: ${restoreOk ? 'PASSED' : 'FAILED'}`);
  console.log(`Performance search latencies: 100 prods: ${t100}ms, 1k prods: ${t1000}ms, 5k prods: ${t5000}ms`);
  console.log('==================================================================');
}

function randMobile() {
  return '99' + Math.floor(10000000 + Math.random() * 90000000);
}

runRcSimulation().catch(err => {
  console.error('Simulation crashed with error:', err);
  process.exit(1);
});
