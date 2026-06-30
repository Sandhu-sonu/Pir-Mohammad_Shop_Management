import { prisma } from '../src/db/prisma';

async function main() {
  console.log('=== INSPECTING CUSTOMERS TABLE ===');
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' }
  });
  console.log(`Total customers found: ${customers.length}`);
  for (const c of customers) {
    console.log(`ID: ${c.id} | Name: ${c.name} | Mobile: ${JSON.stringify(c.mobile)} | Deleted: ${c.isDeleted} | ShopId: ${c.shopId}`);
  }

  console.log('\n=== INSPECTING SUPPLIERS TABLE ===');
  const suppliers = await prisma.supplier.findMany({
    orderBy: { createdAt: 'desc' }
  });
  console.log(`Total suppliers found: ${suppliers.length}`);
  for (const s of suppliers) {
    console.log(`ID: ${s.id} | Name: ${s.name} | Mobile: ${JSON.stringify(s.mobile)} | GST: ${JSON.stringify(s.gst)} | Deleted: ${s.isDeleted}`);
  }
}

main().then(() => prisma.$disconnect());
