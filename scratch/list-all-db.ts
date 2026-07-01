import { prisma } from '../src/db/prisma';

async function main() {
  const shops = await prisma.shop.findMany();
  const users = await prisma.user.findMany();

  console.log('SHOPS count:', shops.length);
  for (const s of shops) {
    console.log(`  Shop ID: ${s.id}, Name: ${s.name}`);
  }

  console.log('USERS count:', users.length);
  for (const u of users) {
    console.log(`  User ID: ${u.id}, Name: ${u.name}, Shop ID: ${u.shopId}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
