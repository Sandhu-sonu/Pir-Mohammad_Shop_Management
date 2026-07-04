import { getCurrentUser } from '@/lib/actions/auth';
import { prisma } from '@/db/prisma';
import { redirect } from 'next/navigation';
import Shell from '@/components/layout/Shell';
import { Role, SubscriptionStatus } from '@prisma/client';
import SessionTimeoutWarning from '@/components/common/SessionTimeoutWarning';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  // 1. Redirection for Super Admin
  if (user.role === Role.SUPER_ADMIN) {
    redirect('/admin');
  }

  // 2. Fetch Shop with Active Subscription Status
  const shop = await prisma.shop.findUnique({
    where: { id: user.shopId },
    include: {
      subscription: true
    }
  });

  if (!shop) {
    redirect('/');
  }

  // 3. Check Suspension lockout
  if (shop.isSuspended) {
    redirect('/suspended');
  }

  // 4. Check Subscription expiration
  if (shop.subscription) {
    const sub = shop.subscription;
    if (sub.status === SubscriptionStatus.EXPIRED || sub.status === SubscriptionStatus.SUSPENDED) {
      redirect('/trial-expired');
    }

    // Auto check date bounds
    if (new Date() > new Date(sub.endDate)) {
      await prisma.subscription.update({
        where: { shopId: shop.id },
        data: { status: SubscriptionStatus.EXPIRED }
      });
      redirect('/trial-expired');
    }
  }

  // 5. Check if Setup Wizard is completed (requires at least 1 product)
  const productCount = await prisma.product.count({
    where: { shopId: shop.id, isDeleted: false }
  });

  if (productCount === 0) {
    redirect('/setup-wizard');
  }

  return (
    <Shell userName={user.name} shopName={shop.name || 'Punjab Shop'}>
      <SessionTimeoutWarning />
      {children}
    </Shell>
  );
}
