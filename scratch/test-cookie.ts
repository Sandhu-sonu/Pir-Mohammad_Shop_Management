import { prisma } from '../src/db/prisma';

async function main() {
  const user = await prisma.user.findFirst({
    where: { role: 'OWNER' },
    include: { shop: true }
  });

  if (!user) {
    console.log('No owner user found.');
    return;
  }

  const sessionData = {
    userId: user.id,
    name: user.name,
    role: user.role,
    shopId: user.shopId,
    businessType: user.shop.businessType,
  };

  const cookieStr = `session=${encodeURIComponent(JSON.stringify(sessionData))}`;
  console.log('\nUse the following curl command in a new terminal to check the dashboard output:');
  console.log(`curl -v -H "Cookie: ${cookieStr}" http://localhost:3000/dashboard`);
}

main().then(() => prisma.$disconnect());
