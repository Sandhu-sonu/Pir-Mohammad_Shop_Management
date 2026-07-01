import { getCurrentUser } from '@/lib/actions/auth';
import { prisma } from '@/db/prisma';
import { redirect } from 'next/navigation';
import Shell from '@/components/layout/Shell';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  const shop = await prisma.shop.findUnique({
    where: { id: user.shopId },
    select: { name: true },
  });

  return (
    <Shell userName={user.name} shopName={shop?.name || 'Punjab Shop'}>
      {children}
    </Shell>
  );
}
