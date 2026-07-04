import 'dotenv/config';
import { Module } from 'module';
import { prisma } from '../src/db/prisma';

async function runTests() {
  console.log('=== RETRIEVING OWNER DETAILS FROM DATABASE ===');
  const user = await prisma.user.findFirst({
    where: { role: 'OWNER' },
    include: { shop: { include: { settings: true } } }
  });

  if (!user) {
    throw new Error('No OWNER user found in database. Run npm run test first to seed database.');
  }

  console.log(`Using OWNER user: ${user.name} (${user.id}) for Shop: ${user.shop.name} (${user.shopId})`);

  // Stub next/headers using Node Module loader interceptor before importing actions
  const mockSession = {
    userId: user.id,
    name: user.name,
    role: user.role,
    shopId: user.shopId,
    businessType: user.shop.businessType,
    mobile: user.mobile,
    shopName: user.shop.name,
    printerType: user.shop.settings?.printerType || 'THERMAL_80'
  };

  const originalRequire = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id === 'next/headers') {
      return {
        cookies: async () => ({
          get: (name: string) => {
            if (name === 'session') {
              return { value: JSON.stringify(mockSession) };
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
          console.log(`[next/cache] revalidatePath called for URL: ${path}`);
        }
      };
    }
    return originalRequire.apply(this, arguments as any);
  };

  // Now dynamically import Server Actions!
  const { addProductAction } = require('../src/lib/actions/inventory');
  const { addCustomerAction } = require('../src/lib/actions/customers');
  const { createSupplierAction } = require('../src/lib/actions/suppliers');
  const { createSaleAction } = require('../src/lib/actions/sales');
  const { createPurchaseAction } = require('../src/lib/actions/purchases');
  const { createExpenseAction } = require('../src/lib/actions/expenses');
  const { saveClosingAction } = require('../src/lib/actions/closing');
  const { updateShopSettingsAction } = require('../src/lib/actions/settings');
  const { createBackupAction } = require('../src/lib/actions/backups');

  console.log('\n=== RUNNING SERVER ACTION INTEGRATION TESTS ===');

  const stamp = Date.now();
  const randMobile = '99' + Math.floor(10000000 + Math.random() * 90000000);

  // 1. Add Product Action
  console.log('\n--- 1. Testing addProductAction ---');
  const product = await addProductAction({
    nameEn: 'Action Sugar ' + stamp,
    namePa: 'ਐਕਸ਼ਨ ਖੰਡ ' + stamp,
    sku: 'SKU-' + stamp,
    barcode: 'BAR-' + stamp,
    purchasePrice: 40,
    sellingPrice: 45,
    currentQuantity: 100,
    minStock: 10,
    unit: 'kg'
  });
  if (product.success) {
    console.log(`... Product created successfully: ${product.product.nameEn} (ID: ${product.product.id})`);
  } else {
    throw new Error(`Failed to create product: ${product.error}`);
  }

  // 2. Add Customer Action
  console.log('\n--- 2. Testing addCustomerAction ---');
  const customerResult = await addCustomerAction({
    name: 'Action Customer ' + stamp,
    mobile: randMobile,
    email: 'action-' + stamp + '@test.com',
    address: 'Amritsar',
    openingBalance: 1500
  });
  if (customerResult.success) {
    console.log(`... Customer created successfully: ${customerResult.customer.name} (ID: ${customerResult.customer.id})`);
  } else {
    throw new Error(`Failed to create customer: ${customerResult.error}`);
  }

  // 3. Add Supplier Action
  console.log('\n--- 3. Testing createSupplierAction ---');
  const supplier = await createSupplierAction({
    name: 'Action Supplier ' + stamp,
    mobile: '98' + Math.floor(10000000 + Math.random() * 90000000),
    gst: '03ACT' + Math.floor(1000 + Math.random() * 9000) + 'A1Z1',
    currentBalance: 0
  });
  if (supplier && supplier.id) {
    console.log(`... Supplier created successfully: ${supplier.name} (ID: ${supplier.id})`);
  } else {
    throw new Error(`Failed to create supplier: ${JSON.stringify(supplier)}`);
  }

  // 4. Sales POS Checkout Action
  console.log('\n--- 4. Testing createSaleAction (POS Checkout) ---');
  const saleResult = await createSaleAction({
    customerId: customerResult.customer.id,
    items: [
      {
        productId: product.product.id,
        quantity: 5,
        sellingPrice: 45,
        originalPrice: 45,
        itemDiscount: 0,
        discountType: 'PERCENT'
      }
    ],
    discount: 0,
    paymentMethod: 'CASH',
    paidAmount: 225,
    billDiscount: 0,
    billDiscountType: 'PERCENT'
  });
  if (saleResult.success) {
    console.log(`... Sale checkout completed. Invoice: ${saleResult.sale.invoiceNumber}`);
  } else {
    throw new Error(`Failed to checkout sale: ${saleResult.error}`);
  }

  // 5. Create Purchase Order Action
  console.log('\n--- 5. Testing createPurchaseAction ---');
  const purchase = await createPurchaseAction({
    supplierId: supplier.id,
    items: [
      {
        productId: product.product.id,
        quantity: 20,
        purchasePrice: 40
      }
    ],
    invoiceNumber: 'INV-' + stamp,
    note: 'Server Action Purchase Order test',
    paidAmount: 800,
    status: 'RECEIVED'
  });
  if (purchase && purchase.id) {
    console.log(`... Purchase order logged and received. ID: ${purchase.id}`);
  } else {
    throw new Error(`Failed to create purchase order: ${JSON.stringify(purchase)}`);
  }

  // 6. Create Expense Action
  console.log('\n--- 6. Testing createExpenseAction ---');
  const expense = await createExpenseAction({
    category: 'REPAIR',
    amount: 350,
    description: 'Printer roller repair',
    paymentMethod: 'CASH',
    notes: 'Tested from server action suite'
  });
  if (expense.success) {
    console.log(`... Expense logged successfully. ID: ${expense.expense.id}`);
  } else {
    throw new Error(`Failed to create expense: ${expense.error}`);
  }

  // 7. Save Settings Action
  console.log('\n--- 7. Testing updateShopSettingsAction ---');
  const settingsResult = await updateShopSettingsAction({
    name: user.shop.name,
    address: user.shop.address || 'Updated Address',
    gst: user.shop.gst || 'Updated GST',
    phone: user.shop.phone || '9876543210',
    email: user.shop.email || 'updated@shop.com',
    language: user.shop.settings?.language || 'pa',
    theme: user.shop.settings?.theme || 'light',
    lowStockAlert: user.shop.settings?.lowStockAlert ?? true,
    autoSuggestPunjabi: true,
    autoSuggestEnglish: true
  });
  if (settingsResult.success) {
    console.log('... Shop settings updated successfully.');
  } else {
    throw new Error(`Failed to update shop settings: ${settingsResult.error}`);
  }

  // 8. Close Day Action
  console.log('\n--- 8. Testing saveClosingAction ---');
  const closingResult = await saveClosingAction({
    dateString: new Date().toISOString().slice(0, 10),
    openingCash: 1000,
    closingCash: 1200,
    withdrawals: 0,
    notes: 'Server Action Daily closing test'
  });
  if (closingResult.success) {
    console.log('... Daily closing saved successfully.');
  } else {
    throw new Error(`Failed to save closing: ${closingResult.error}`);
  }

  // 9. Backups Action
  console.log('\n--- 9. Testing createBackupAction ---');
  const backup = await createBackupAction('Test Server Action Backup');
  if (backup.success) {
    console.log(`... Shop data backup created successfully. File: ${backup.filename}`);
  } else {
    throw new Error(`Failed to create backup: ${backup.error}`);
  }

  console.log('\n=== 🎉 ALL SERVER ACTIONS VERIFIED & PASSED! ===');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed with error:', err);
  process.exit(1);
});
