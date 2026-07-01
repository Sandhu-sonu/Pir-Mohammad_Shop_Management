const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const shop = await prisma.shop.findFirst({
    include: { settings: true }
  });
  const user = await prisma.user.findFirst();

  console.log('SHOP:', shop);
  console.log('USER:', user);

  if (shop && user) {
    const sessionData = {
      userId: user.id,
      name: user.name,
      role: user.role,
      shopId: user.shopId,
      businessType: shop.businessType,
      mobile: user.mobile,
      shopName: shop.name,
      printerType: shop.settings?.printerType || 'THERMAL_80',
    };
    console.log('COOKIE_VALUE:', encodeURIComponent(JSON.stringify(sessionData)));
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
