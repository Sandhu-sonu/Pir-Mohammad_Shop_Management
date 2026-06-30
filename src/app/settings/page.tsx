import { getCurrentUser } from '../../lib/actions/auth';
import { prisma } from '../../db/prisma';
import { redirect } from 'next/navigation';
import Shell from '../../components/layout/Shell';
import SettingsClient from './SettingsClient';

export const revalidate = 0;

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  const shop = await prisma.shop.findUnique({
    where: { id: user.shopId },
    include: { settings: true },
  });

  if (!shop) {
    redirect('/');
  }

  return (
    <Shell userName={user.name} shopName={shop.name}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            ਦੁਕਾਨ ਦੀ ਸੈਟਿੰਗ (Shop Settings)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ਦੁਕਾਨ ਦਾ ਨਾਮ, ਜੀ.ਐੱਸ.ਟੀ. ਨੰਬਰ, ਪਤਾ ਅਤੇ ਬੋਲੀ (Shop profiles and localization)
          </p>
        </div>

        <SettingsClient
          shop={JSON.parse(JSON.stringify(shop))}
          role={user.role}
        />
      </div>
    </Shell>
  );
}
