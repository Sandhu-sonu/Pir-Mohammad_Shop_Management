import { prisma } from '../src/db/prisma';
import { CustomerRepository } from '../src/db/repositories/CustomerRepository';

async function main() {
  console.log('Testing customer creation scenarios...');
  const shop = await prisma.shop.findFirst();
  if (!shop) {
    console.error('No shop found in database.');
    return;
  }
  const shopId = shop.id;
  console.log(`Using shopId: ${shopId}`);

  // Scenario 1: Customer with mobile number
  try {
    const mobileNum = '98123' + Math.floor(10000 + Math.random() * 90000);
    console.log(`Scenario 1: Creating customer with mobile ${mobileNum}...`);
    const c1 = await CustomerRepository.create({
      shopId,
      name: 'Amrit Singh ' + Date.now(),
      mobile: mobileNum,
      openingBalance: 0,
    });
    console.log(`✔ Success: ${c1.name} created.`);
  } catch (err: any) {
    console.error(`❌ Failed:`, err);
  }

  // Scenario 2: First customer with null/empty mobile
  let firstCustomerId = '';
  try {
    console.log('Scenario 2: Creating first customer with mobile: null...');
    const c2 = await CustomerRepository.create({
      shopId,
      name: 'Walkin Cust A ' + Date.now(),
      mobile: null as any,
      openingBalance: 0,
    });
    firstCustomerId = c2.id;
    console.log(`✔ Success: ${c2.name} created.`);
  } catch (err: any) {
    console.error(`❌ Failed:`, err);
  }

  // Scenario 3: Second customer with null/empty mobile
  try {
    console.log('Scenario 3: Creating second customer with mobile: null...');
    const c3 = await CustomerRepository.create({
      shopId,
      name: 'Walkin Cust B ' + Date.now(),
      mobile: null as any,
      openingBalance: 0,
    });
    console.log(`✔ Success: ${c3.name} created.`);
  } catch (err: any) {
    console.error(`❌ Failed:`, err);
  }

  // Scenario 4: Customer with empty string mobile
  try {
    console.log('Scenario 4: Creating customer with mobile: "" (empty string)...');
    const c4 = await CustomerRepository.create({
      shopId,
      name: 'Walkin Cust C ' + Date.now(),
      mobile: '',
      openingBalance: 0,
    });
    console.log(`✔ Success: ${c4.name} created.`);
  } catch (err: any) {
    console.error(`❌ Failed:`, err);
  }

  // Scenario 5: Another customer with empty string mobile
  try {
    console.log('Scenario 5: Creating another customer with mobile: "" (empty string)...');
    const c5 = await CustomerRepository.create({
      shopId,
      name: 'Walkin Cust D ' + Date.now(),
      mobile: '',
      openingBalance: 0,
    });
    console.log(`✔ Success: ${c5.name} created.`);
  } catch (err: any) {
    console.error(`❌ Failed:`, err);
  }

  // Cleanup testing customers
  console.log('Cleaning up testing customers...');
  await prisma.customerLedger.deleteMany({
    where: { customer: { name: { contains: 'Amrit Singh' } } }
  });
  await prisma.customerLedger.deleteMany({
    where: { customer: { name: { contains: 'Walkin Cust' } } }
  });
  await prisma.customer.deleteMany({
    where: { name: { contains: 'Amrit Singh' } }
  });
  await prisma.customer.deleteMany({
    where: { name: { contains: 'Walkin Cust' } }
  });
  console.log('Cleanup completed.');
}

main().then(() => prisma.$disconnect());
