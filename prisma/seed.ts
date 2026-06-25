import { Role, TransactionType, CustomerLedgerType, SupplierLedgerType } from '@prisma/client';
import { prisma } from '../src/db/prisma';

async function main() {
  console.log('Seeding database...');

  // 1. Create Shop
  const shop = await prisma.shop.create({
    data: {
      name: 'Sher-E-Punjab Retail',
      address: 'G.T. Road, Jalandhar, Punjab',
      gst: '03AAAAA1111A1Z1',
      currency: 'INR',
    },
  });
  console.log(`Created shop: ${shop.name} (${shop.id})`);

  // 2. Create Settings
  const settings = await prisma.settings.create({
    data: {
      shopId: shop.id,
      language: 'pa',
      theme: 'light',
      lowStockAlert: true,
    },
  });
  console.log(`Created settings for shop`);

  // 3. Create Owner User
  const owner = await prisma.user.create({
    data: {
      name: 'Baljinder Singh',
      mobile: '9876543210',
      password: 'password123', // In production, hash this password
      role: Role.OWNER,
      shopId: shop.id,
    },
  });
  console.log(`Created owner user: ${owner.name}`);

  // 4. Create Supplier
  const supplier = await prisma.supplier.create({
    data: {
      name: 'Majha Agro & Wholesalers',
      mobile: '9812345678',
      gst: '03BBBBB2222B2Z2',
      shopId: shop.id,
      currentBalance: 5000.00, // We owe them 5000 initially
    },
  });
  console.log(`Created supplier: ${supplier.name}`);

  // Create supplier ledger entry for opening balance
  await prisma.supplierLedger.create({
    data: {
      supplierId: supplier.id,
      type: SupplierLedgerType.OPENING,
      amount: 5000.00,
      balanceAfter: 5000.00,
      note: 'Opening outstanding balance',
    },
  });

  // 5. Create Customers
  const customer1 = await prisma.customer.create({
    data: {
      name: 'Gurpreet Singh',
      mobile: '9888877777',
      address: 'Model Town, Jalandhar',
      notes: 'Regular customer, pays monthly',
      openingBalance: 1500.00,
      currentBalance: 1500.00, // Owes us 1500
      shopId: shop.id,
    },
  });

  await prisma.customerLedger.create({
    data: {
      customerId: customer1.id,
      type: CustomerLedgerType.OPENING,
      amount: 1500.00,
      balanceAfter: 1500.00,
      note: 'Opening Udhaar balance',
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      name: 'Harpreet Kaur',
      mobile: '9777766666',
      address: 'Urban Estate, Jalandhar',
      notes: 'Kirana accounts',
      openingBalance: 0.00,
      currentBalance: 0.00,
      shopId: shop.id,
    },
  });
  console.log(`Created customers: ${customer1.name}, ${customer2.name}`);

  // Create Categories first
  const groceryCategory = await prisma.category.create({
    data: { name: 'Grocery', shopId: shop.id }
  });
  const beverageCategory = await prisma.category.create({
    data: { name: 'Beverage', shopId: shop.id }
  });

  // 6. Create Products with English & Punjabi names
  const productsData = [
    {
      sku: 'WHT-001',
      barcode: '8901234001',
      nameEn: 'Kanak Aata (Wheat Flour) 10kg',
      namePa: 'ਕਣਕ ਦਾ ਆਟਾ 10 ਕਿਲੋ',
      categoryId: groceryCategory.id,
      categoryName: groceryCategory.name,
      purchasePrice: 320.00,
      sellingPrice: 380.00,
      currentQuantity: 50.00,
      unit: 'BAG',
      minStock: 10.00,
      supplierId: supplier.id,
    },
    {
      sku: 'SGR-002',
      barcode: '8901234002',
      nameEn: 'Cheeni (Sugar) 1kg',
      namePa: 'ਖੰਡ 1 ਕਿਲੋ',
      categoryId: groceryCategory.id,
      categoryName: groceryCategory.name,
      purchasePrice: 38.00,
      sellingPrice: 45.00,
      currentQuantity: 200.00,
      unit: 'KG',
      minStock: 20.00,
      supplierId: supplier.id,
    },
    {
      sku: 'TEA-003',
      barcode: '8901234003',
      nameEn: 'Wagh Bakri Chai 500g',
      namePa: 'ਵਾਘ ਬਕਰੀ ਚਾਹ 500ਗ੍ਰਾਮ',
      categoryId: beverageCategory.id,
      categoryName: beverageCategory.name,
      purchasePrice: 180.00,
      sellingPrice: 220.00,
      currentQuantity: 30.00,
      unit: 'PCS',
      minStock: 5.00,
      supplierId: supplier.id,
    },
    {
      sku: 'OIL-004',
      barcode: '8901234004',
      nameEn: 'Sarso Tel (Mustard Oil) 1L',
      namePa: 'ਸਰੋਂ ਦਾ ਤੇਲ 1 ਲੀਟਰ',
      categoryId: groceryCategory.id,
      categoryName: groceryCategory.name,
      purchasePrice: 145.00,
      sellingPrice: 175.00,
      currentQuantity: 80.00,
      unit: 'BOTTLE',
      minStock: 15.00,
      supplierId: supplier.id,
    },
  ];

  for (const prod of productsData) {
    const product = await prisma.product.create({
      data: {
        ...prod,
        shopId: shop.id,
      },
    });

    // Create opening inventory transaction
    await prisma.inventoryTransaction.create({
      data: {
        productId: product.id,
        type: TransactionType.PURCHASE,
        quantity: product.currentQuantity,
        previousQty: 0,
        newQty: product.currentQuantity,
        note: 'Initial opening stock',
      },
    });
    console.log(`Created product: ${product.nameEn} / ${product.namePa}`);
  }

  // 7. Create some historical Expenses
  await prisma.expense.createMany({
    data: [
      {
        category: 'RENT',
        amount: 8000.00,
        description: 'Shop rent for June',
        shopId: shop.id,
        date: new Date('2026-06-01T00:00:00Z'),
      },
      {
        category: 'ELECTRICITY',
        amount: 2450.00,
        description: 'PSPCL Electricity Bill',
        shopId: shop.id,
        date: new Date('2026-06-15T00:00:00Z'),
      },
    ],
  });
  console.log('Created dummy expenses');

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
