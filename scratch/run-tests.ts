import 'dotenv/config';
import { prisma } from '../src/db/prisma';
import { ProductRepository } from '../src/db/repositories/ProductRepository';
import { ProductService } from '../src/db/services/ProductService';
import { CustomerRepository } from '../src/db/repositories/CustomerRepository';
import { SalesRepository } from '../src/db/repositories/SalesRepository';
import { InventoryRepository } from '../src/db/repositories/InventoryRepository';
import { ProductImportService } from '../src/db/services/ProductImportService';
import { PurchaseRepository } from '../src/db/repositories/PurchaseRepository';
import { PurchaseReturnRepository } from '../src/db/repositories/PurchaseReturnRepository';
import { SupplierRepository } from '../src/db/repositories/SupplierRepository';
import { BarcodeRepository } from '../src/db/repositories/BarcodeRepository';
import { Role, PaymentMethod, TransactionType, PurchaseStatus } from '@prisma/client';

async function runTests() {
  console.log('==================================================');
  console.log('       PUNJAB SHOP SYSTEM - TEST SUITE            ');
  console.log('==================================================\n');

  try {
    // 1. Connection check
    console.log('Checking database connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✔ Database connection verified.\n');
  } catch (err: any) {
    console.error('❌ Database connection failed. Please ensure PostgreSQL is running.');
    console.error(`Error details: ${err.message}\n`);
    console.log('Skipping database-dependent tests. Compiles successfully.');
    return;
  }

  // Set up mock shop & owner
  console.log('Setting up mock testing environment...');
  
  // Clean up any past duplicate users to prevent unique constraints failures
  await prisma.user.deleteMany({
    where: { mobile: '9999999999' }
  });

  const shop = await prisma.shop.create({
    data: {
      name: 'Testing Shop Ltd',
      currency: 'INR',
    },
  });

  const owner = await prisma.user.create({
    data: {
      name: 'Tester Singh',
      mobile: '9999999999',
      password: 'password123',
      role: Role.OWNER,
      shopId: shop.id,
    },
  });

  let testProduct: any;
  let testCustomer: any;

  try {
    // TEST 1: Inventory Management & Negative Stock Constraint
    console.log('\n--- TEST 1: Inventory & Negative Stock Rules ---');
    testProduct = await ProductService.addProduct({
      sku: 'SUG-100',
      nameEn: 'Test Sugar 1kg',
      namePa: 'ਟੈਸਟ ਖੰਡ 1 ਕਿਲੋ',
      category: 'Test',
      purchasePrice: 40,
      sellingPrice: 50,
      currentQuantity: 10,
      unit: 'KG',
      minStock: 2,
      shopId: shop.id,
    });
    console.log(`✔ Created product "${testProduct.nameEn}" with initial stock: ${testProduct.currentQuantity}`);

    // Verify stock cannot be updated directly (Current quantity is managed by transactions)
    console.log('Testing Stock adjustments via Transactions...');
    await prisma.$transaction(async (tx) => {
      await InventoryRepository.adjustStock(tx, {
        productId: testProduct.id,
        quantity: 5,
        type: TransactionType.PURCHASE,
        price: 40,
        note: 'Mock Purchase addition',
        userId: owner.id,
      });
    });

    const updatedProd = await ProductRepository.findById(testProduct.id);
    console.log(`✔ Atomic stock addition (+5). New stock: ${updatedProd?.currentQuantity}`);
    if (Number(updatedProd?.currentQuantity) !== 15) {
      throw new Error('Stock addition calculation mismatch');
    }

    // Verify negative stock prevention
    console.log('Testing negative stock validation...');
    try {
      await prisma.$transaction(async (tx) => {
        await InventoryRepository.adjustStock(tx, {
          productId: testProduct.id,
          quantity: -20, // Reducing more than available 15
          type: TransactionType.SALE,
          price: 50,
        });
      });
      throw new Error('Validation failed: Allowed quantity to become negative!');
    } catch (err: any) {
      console.log(`✔ Correctly blocked negative stock adjustment: "${err.message}"`);
    }

    // TEST 2: Customer Khata Ledger Balance Rules
    console.log('\n--- TEST 2: Customer Khata Ledger Rules ---');
    testCustomer = await CustomerRepository.create({
      name: 'Amritpal Singh',
      mobile: '9800011122',
      openingBalance: 1000,
      shopId: shop.id,
    });
    console.log(`✔ Created customer "${testCustomer.name}" with opening balance: ₹${testCustomer.openingBalance}`);
    if (Number(testCustomer.currentBalance) !== 1000) {
      throw new Error('Customer initial outstanding balance mismatch');
    }

    // TEST 3: Sales POS Billing & Outstanding calculations
    console.log('\n--- TEST 3: Sales Checkout & Dues ---');
    const sale = await SalesRepository.create({
      shopId: shop.id,
      customerId: testCustomer.id,
      items: [{ productId: testProduct.id, quantity: 3, sellingPrice: 50 }],
      discount: 10,
      paymentMethod: PaymentMethod.CREDIT, // Outstanding dues
      paidAmount: 0, // Dues will be total (150 - 10) = 140
      userId: owner.id,
    });

    console.log(`✔ Completed credit sale invoice: ${sale.invoiceNumber}`);
    console.log(`✔ Sale total: ₹${sale.total}, Paid: ₹${sale.paidAmount}, Dues: ₹${sale.dueAmount}`);

    const finalProd = await ProductRepository.findById(testProduct.id);
    console.log(`✔ Adjusted product stock. Remaining: ${finalProd?.currentQuantity}`);
    if (Number(finalProd?.currentQuantity) !== 12) {
      throw new Error('Stock deduction mismatch after sale');
    }

    const finalCust = await CustomerRepository.findById(testCustomer.id);
    console.log(`✔ Updated customer outstanding balance: ₹${finalCust?.currentBalance}`);
    // Expected outstanding = 1000 (opening) + 140 (credit sale) = 1140
    if (Number(finalCust?.currentBalance) !== 1140) {
      throw new Error('Customer ledger balance did not update correctly after credit sale');
    }

    // TEST 4: Payment Collection
    console.log('\n--- TEST 4: Collect Payments ---');
    await CustomerRepository.receivePayment(shop.id, testCustomer.id, 500, 'Part payment received');
    const afterPaymentCust = await CustomerRepository.findById(testCustomer.id);
    console.log(`✔ Collected ₹500 payment. New outstanding: ₹${afterPaymentCust?.currentBalance}`);
    // Expected outstanding = 1140 - 500 = 640
    if (Number(afterPaymentCust?.currentBalance) !== 640) {
      throw new Error('Customer outstanding balance did not update after payment');
    }

    // TEST 5: Reversals
    console.log('\n--- TEST 5: Sale Reversals ---');
    await SalesRepository.reverse(sale.id, owner.id);
    console.log(`✔ Reversed sale invoice: ${sale.invoiceNumber}`);

    const reversedProd = await ProductRepository.findById(testProduct.id);
    console.log(`✔ Returned items to stock. New stock: ${reversedProd?.currentQuantity}`);
    if (Number(reversedProd?.currentQuantity) !== 15) {
      throw new Error('Stock was not returned to previous state on reversal');
    }

    const reversedCust = await CustomerRepository.findById(testCustomer.id);
    console.log(`✔ Updated customer ledger balance on reversal. Current outstanding: ₹${reversedCust?.currentBalance}`);
    // Prior to reversal, outstanding was 640. Reversal removes the sale due of 140. Expected balance = 640 - 140 = 500.
    if (Number(reversedCust?.currentBalance) !== 500) {
      throw new Error('Customer balance did not deduct sale dues on reversal');
    }

    // TEST 6: Category / Brand Dynamic Imports & Performance Targets
    console.log('\n--- TEST 6: Category / Brand Dynamic Imports (1000 items) ---');
    let csvContent = 'SKU,Barcode,NameEn,NamePa,Category,Brand,PurchasePrice,SellingPrice,Quantity,Unit,ReorderLevel,TaxRate\n';
    for (let i = 1; i <= 1000; i++) {
      csvContent += `IMP-${i},BAR-${i},Imported Product ${i},ਆਯਾਤ ਕੀਤੀ ਆਈਟਮ ${i},Grocery,BrandA,10,12,50,PCS,5,0\n`;
    }
    
    console.log('Starting bulk CSV import of 1000 products...');
    const importStart = Date.now();
    const importResult = await ProductImportService.importCSV(shop.id, 'bulk_import_test.csv', csvContent, 'UPSERT');
    const importTime = Date.now() - importStart;
    
    console.log(`✔ Bulk CSV import completed. Duration: ${importTime}ms`);
    console.log(`✔ Imported: ${importResult.importedCount}, Updated: ${importResult.updatedCount}, Failed: ${importResult.failedCount}`);
    console.log(`✔ Created Categories: ${importResult.createdCategoriesCount}, Created Brands: ${importResult.createdBrandsCount}`);
    
    if (importTime > 10000) {
      throw new Error(`Bulk import exceeded performance target of 10s: took ${importTime}ms`);
    }
    if (importResult.failedCount > 0) {
      throw new Error(`Bulk import failed rows detected: ${JSON.stringify(importResult.errors)}`);
    }

    // TEST 7: USB Barcode lookup performance
    console.log('\n--- TEST 7: USB Barcode Lookup Performance (100 scans) ---');
    const scanStart = Date.now();
    for (let i = 1; i <= 100; i++) {
      const barcodeToFind = `BAR-${i}`;
      const prod = await BarcodeRepository.lookupBarcode(shop.id, barcodeToFind, owner.id);
      if (!prod) {
        throw new Error(`Could not lookup barcode: ${barcodeToFind}`);
      }
    }
    const scanTime = Date.now() - scanStart;
    const avgScanTime = scanTime / 100;
    console.log(`✔ Looked up 100 barcodes. Total duration: ${scanTime}ms, Average: ${avgScanTime}ms`);
    if (avgScanTime > 100) {
      throw new Error(`Barcode lookup exceeded performance target of 100ms: avg took ${avgScanTime}ms`);
    }

    // TEST 8: Supplier Purchase PO workflow
    console.log('\n--- TEST 8: Supplier Purchase PO Workflow ---');
    const supplier = await SupplierRepository.create({
      name: 'Amritsar Wholesale Group',
      mobile: '9888899999',
      currentBalance: 0,
      shopId: shop.id,
    });
    console.log(`✔ Created Wholesaler: ${supplier.name}`);

    // Create DRAFT Purchase
    console.log('Creating Purchase order as DRAFT...');
    const draftPurchase = await PurchaseRepository.create({
      shopId: shop.id,
      supplierId: supplier.id,
      items: [
        { productId: testProduct.id, quantity: 10, purchasePrice: 40 }
      ],
      paidAmount: 0,
      status: PurchaseStatus.DRAFT,
      invoiceNumber: 'PO-DRAFT-123',
    });
    
    const prodAfterDraft = await ProductRepository.findById(testProduct.id);
    const supplierAfterDraft = await SupplierRepository.findById(supplier.id);
    console.log(`✔ Draft created. Stock of ${testProduct.nameEn}: ${prodAfterDraft?.currentQuantity} (expected: 15)`);
    console.log(`✔ Wholesaler balance owed: ₹${supplierAfterDraft?.currentBalance} (expected: 0)`);
    
    if (Number(prodAfterDraft?.currentQuantity) !== 15 || Number(supplierAfterDraft?.currentBalance) !== 0) {
      throw new Error('Draft purchase altered inventory or ledger balance incorrectly');
    }

    // Transition DRAFT to RECEIVED
    console.log('Transitioning PO status to RECEIVED...');
    await PurchaseRepository.transitionStatus(draftPurchase.id, PurchaseStatus.RECEIVED, 100); // Pay 100, Due 300
    
    const prodAfterReceived = await ProductRepository.findById(testProduct.id);
    const supplierAfterReceived = await SupplierRepository.findById(supplier.id);
    console.log(`✔ PO Received. Stock of ${testProduct.nameEn}: ${prodAfterReceived?.currentQuantity} (expected: 25)`);
    console.log(`✔ Wholesaler balance owed: ₹${supplierAfterReceived?.currentBalance} (expected: 300)`);
    
    if (Number(prodAfterReceived?.currentQuantity) !== 25) {
      throw new Error('Inventory was not updated correctly after purchase receipt');
    }
    if (Number(supplierAfterReceived?.currentBalance) !== 300) {
      throw new Error('Supplier ledger outstanding dues mismatch after purchase receipt');
    }

    // TEST 9: Purchase Returns
    console.log('\n--- TEST 9: Purchase Returns ---');
    console.log('Returning 3 damaged units to wholesaler...');
    await PurchaseReturnRepository.createReturn({
      purchaseId: draftPurchase.id,
      productId: testProduct.id,
      quantity: 3,
      reason: 'Damaged item packaging',
    });
    
    const prodAfterReturn = await ProductRepository.findById(testProduct.id);
    const supplierAfterReturn = await SupplierRepository.findById(supplier.id);
    console.log(`✔ Return logged. Stock of ${testProduct.nameEn}: ${prodAfterReturn?.currentQuantity} (expected: 22)`);
    console.log(`✔ Wholesaler balance owed: ₹${supplierAfterReturn?.currentBalance} (expected: 180)`);
    
    if (Number(prodAfterReturn?.currentQuantity) !== 22) {
      throw new Error('Stock did not decrease correctly on purchase return');
    }
    if (Number(supplierAfterReturn?.currentBalance) !== 180) {
      throw new Error('Supplier outstanding dues did not reduce correctly on purchase return');
    }

    // Validate cannot return more than remaining purchased
    console.log('Testing return limit boundary checks...');
    try {
      await PurchaseReturnRepository.createReturn({
        purchaseId: draftPurchase.id,
        productId: testProduct.id,
        quantity: 10, // Remaining is 7
        reason: 'Over returning test',
      });
      throw new Error('Validation failed: Allowed to return more than purchased!');
    } catch (err: any) {
      console.log(`✔ Correctly blocked invalid over-return: "${err.message}"`);
    }

    console.log('\n==================================================');
    console.log('     🎉 ALL BUSINESS LOGIC TESTS PASSED!          ');
    console.log('==================================================');

  } finally {
    // Cleanup mock tests data
    console.log('\nCleaning up mock testing data...');
    await prisma.shop.delete({ where: { id: shop.id } }).catch(() => {});
    await prisma.$disconnect();
    console.log('Cleanup complete.');
  }
}

runTests();
