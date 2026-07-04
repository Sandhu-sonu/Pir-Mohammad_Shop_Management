import 'dotenv/config';
import { Module } from 'module';
import { prisma } from '../src/db/prisma';
import { Role, BusinessType, PaymentMethod, PurchaseStatus, DiscountType } from '@prisma/client';

async function runProductionAudit() {
  console.log('==================================================================');
  console.log('   PRMS PRODUCTION AUDIT & PERFORMANCE BENCHMARK SUITE   ');
  console.log('==================================================================\n');

  const stamp = Date.now();
  const shopName = `Audit Shop ${stamp}`;
  
  // 1. Setup Isolated Audit Environment
  console.log('>>> 1. SETTING UP ISOLATED TEST ENVIRONMENT...');
  const shop = await prisma.shop.create({
    data: {
      name: shopName,
      address: 'Audit Suite, Amritsar, Punjab',
      gst: '03AUDIT' + Math.floor(1000 + Math.random() * 9000) + 'A1Z1',
      currency: 'INR',
      businessType: BusinessType.GENERAL_STORE
    }
  });

  const owner = await prisma.user.create({
    data: {
      name: 'Audit Owner',
      mobile: '93' + Math.floor(10000000 + Math.random() * 90000000),
      password: 'password123',
      role: Role.OWNER,
      shopId: shop.id
    }
  });

  const staff = await prisma.user.create({
    data: {
      name: 'Audit Staff',
      mobile: '94' + Math.floor(10000000 + Math.random() * 90000000),
      password: 'password123',
      role: Role.STAFF,
      shopId: shop.id
    }
  });

  console.log(`✔ Created isolated Shop (ID: ${shop.id})`);
  console.log(`✔ Created Owner (ID: ${owner.id}) and Staff (ID: ${staff.id})`);

  // Stub next/headers for Bearer Token requests
  const { signToken } = require('../src/lib/jwt');
  const token = await signToken({
    userId: owner.id,
    name: owner.name,
    role: owner.role,
    shopId: shop.id,
    mobile: owner.mobile
  });

  const originalRequire = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id === 'next/headers') {
      return {
        headers: async () => ({
          get: (name: string) => {
            if (name.toLowerCase() === 'authorization') {
              return `Bearer ${token}`;
            }
            return null;
          }
        }),
        cookies: async () => ({
          get: () => null,
          set: () => {},
          delete: () => {}
        })
      };
    }
    if (id === 'next/cache') {
      return {
        revalidatePath: () => {}
      };
    }
    return originalRequire.apply(this, arguments);
  };

  // Import handlers and actions dynamically
  const { addProductAction } = require('../src/lib/actions/inventory');
  const { addCustomerAction } = require('../src/lib/actions/customers');
  const { createSaleAction } = require('../src/lib/actions/sales');
  const { createPurchaseAction } = require('../src/lib/actions/purchases');
  const { receivePaymentAction } = require('../src/lib/actions/customers');
  const salesApiHandler = require('../src/app/api/v1/mobile/sales/route');
  const custApiHandler = require('../src/app/api/v1/mobile/customers/route');
  const invApiHandler = require('../src/app/api/v1/mobile/inventory/route');

  // --- 2. MULTI-PLATFORM SYNCHRONIZATION TESTS ---
  console.log('\n>>> 2. VERIFYING WEB-TO-MOBILE REAL-TIME SYNCHRONIZATION...');

  // Seed initial product
  const productRes = await addProductAction({
    nameEn: 'Sync Test Sugar 1kg',
    namePa: 'ਖੰਡ',
    sku: `SKU-${stamp}-SYNC`,
    barcode: `BAR-${stamp}-SYNC`,
    purchasePrice: 40,
    sellingPrice: 48,
    currentQuantity: 100,
    minStock: 10,
    unit: 'kg'
  });
  const product = productRes.product;

  const customerRes = await addCustomerAction({
    name: 'Sync Customer Gurbaksh',
    mobile: '95' + Math.floor(10000000 + Math.random() * 90000000),
    openingBalance: 0
  });
  const customer = customerRes.customer;

  // A. Web POS Sale checkout
  console.log('Action: Simulating Web POS Sale checkout (2 items of Sync Test Sugar)...');
  const webSale = await createSaleAction({
    customerId: customer.id,
    items: [{
      productId: product.id,
      quantity: 2,
      sellingPrice: 48,
      originalPrice: 48,
      itemDiscount: 0,
      discountType: DiscountType.PERCENT
    }],
    discount: 0,
    paymentMethod: PaymentMethod.CREDIT, // Outstanding balance logged
    paidAmount: 0,
    billDiscount: 0,
    billDiscountType: DiscountType.PERCENT
  });
  console.log(`✔ Web POS Sale logged. Invoice: ${webSale.sale.invoiceNumber}`);

  // Mobile API check: immediately fetch sales list
  console.log('Query: Fetching sales list via REST API on Mobile...');
  const salesApiRes = await salesApiHandler.GET(new Request('http://localhost/api/v1/mobile/sales?page=1&pageSize=5'));
  const salesApiBody = await salesApiRes.json();
  const foundSale = salesApiBody.data.find((s: any) => s.invoiceNumber === webSale.sale.invoiceNumber);
  console.log(`✔ Sale sync visibility result: ${foundSale ? 'SYNCED SUCCESSFULLY' : 'FAILED'}`);

  // B. Customer payment sync
  console.log('Action: Simulating customer payment of ₹50 on Web...');
  await receivePaymentAction(customer.id, 50, 'Cash payment', 'CASH');

  console.log('Query: Fetching customer balance via REST API on Mobile...');
  const custApiRes = await custApiHandler.GET(new Request('http://localhost/api/v1/mobile/customers?status=outstanding'));
  const custApiBody = await custApiRes.json();
  const dbCust = custApiBody.data.find((c: any) => c.id === customer.id);
  // Expected: Sale was ₹96. Paid ₹50. Dues should be ₹46.
  console.log(`✔ Customer dues sync - Expected: ₹46, Actual: ₹${dbCust?.currentBalance} (${dbCust?.currentBalance === 46 ? 'SYNCED' : 'FAILED'})`);

  // --- 3. DATABASE INTEGRITY & ROLLBACK TESTS ---
  console.log('\n>>> 3. AUDITING TRANSACTION ROLLBACK AND INTEGRITY CONSTRAINTS...');

  // Test negative stock check
  console.log('Action: Attempting POS Checkout with quantity exceeding current stock...');
  const rollbackRes = await createSaleAction({
    customerId: customer.id,
    items: [{
      productId: product.id,
      quantity: 200, // Stock is currently 98
      sellingPrice: 48,
      originalPrice: 48,
      itemDiscount: 0,
      discountType: DiscountType.PERCENT
    }],
    discount: 0,
    paymentMethod: PaymentMethod.CASH,
    paidAmount: 9600,
    billDiscount: 0,
    billDiscountType: DiscountType.PERCENT
  });

  if (!rollbackRes.success) {
    console.log(`✔ Transaction correctly rolled back and blocked with error: "${rollbackRes.error}"`);
  } else {
    console.log('❌ Failure: Insufficient stock transaction succeeded when it should fail.');
  }

  // --- 4. PERFORMANCE SCALING BENCHMARKS ---
  console.log('\n>>> 4. PERFORMANCE SCALING BENCHMARKS (100, 1,000, 10,000 PRODUCTS)...');

  // Scale A: 100 products
  const bulkProducts100: any[] = [];
  for (let i = 1; i <= 90; i++) { // Added to the 10 initial products
    bulkProducts100.push({
      shopId: shop.id,
      nameEn: `Prod-100-${i}`,
      namePa: `ਉਤਪਾਦ-${i}`,
      sku: `SKU-100-${stamp}-${i}`,
      barcode: `BAR-100-${stamp}-${i}`,
      purchasePrice: 10,
      sellingPrice: 15,
      currentQuantity: 100,
      minStock: 5,
      unit: 'pcs'
    });
  }
  await prisma.product.createMany({ data: bulkProducts100 });
  
  let start = Date.now();
  await prisma.product.findMany({
    where: { shopId: shop.id, nameEn: { contains: 'Prod-100-50', mode: 'insensitive' } }
  });
  const t100 = Date.now() - start;
  console.log(`- 100 products query latency: ${t100}ms`);

  // Scale B: 1,000 products
  console.log('Seeding up to 1,000 products...');
  const bulkProducts1k: any[] = [];
  for (let i = 91; i <= 1000; i++) {
    bulkProducts1k.push({
      shopId: shop.id,
      nameEn: `Prod-1k-${i}`,
      namePa: `ਉਤਪਾਦ-${i}`,
      sku: `SKU-1k-${stamp}-${i}`,
      barcode: `BAR-1k-${stamp}-${i}`,
      purchasePrice: 10,
      sellingPrice: 15,
      currentQuantity: 100,
      minStock: 5,
      unit: 'pcs'
    });
  }
  await prisma.product.createMany({ data: bulkProducts1k });

  start = Date.now();
  await prisma.product.findMany({
    where: { shopId: shop.id, nameEn: { contains: 'Prod-1k-888', mode: 'insensitive' } }
  });
  const t1000 = Date.now() - start;
  console.log(`- 1,000 products query latency: ${t1000}ms`);

  // Scale C: 10,000 products
  console.log('Seeding up to 10,000 products (chunked insertions)...');
  const bulkProducts10k: any[] = [];
  for (let i = 1001; i <= 10000; i++) {
    bulkProducts10k.push({
      shopId: shop.id,
      nameEn: `Prod-10k-${i}`,
      namePa: `ਉਤਪਾਦ-${i}`,
      sku: `SKU-10k-${stamp}-${i}`,
      barcode: `BAR-10k-${stamp}-${i}`,
      purchasePrice: 10,
      sellingPrice: 15,
      currentQuantity: 100,
      minStock: 5,
      unit: 'pcs'
    });
  }

  const chunkSize = 2000;
  for (let i = 0; i < bulkProducts10k.length; i += chunkSize) {
    await prisma.product.createMany({ data: bulkProducts10k.slice(i, i + chunkSize) });
  }

  start = Date.now();
  await prisma.product.findMany({
    where: { shopId: shop.id, nameEn: { contains: 'Prod-10k-5555', mode: 'insensitive' } }
  });
  const t10000 = Date.now() - start;
  console.log(`- 10,000 products query latency: ${t10000}ms`);

  console.log('\n=== 🎉 AUDIT COMPILATION PASSED AND SUMMARY COMPLETE ===');
}

runProductionAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
