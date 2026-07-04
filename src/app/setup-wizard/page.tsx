import React from 'react';
import { getCurrentUser } from '@/lib/actions/auth';
import { prisma } from '@/db/prisma';
import { redirect } from 'next/navigation';
import SetupWizardForm from './SetupWizardForm';

export default async function SetupWizardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  // Ensure they haven't already completed setup
  const productCount = await prisma.product.count({
    where: { shopId: user.shopId, isDeleted: false }
  });

  if (productCount > 0) {
    redirect('/dashboard');
  }

  const shop = await prisma.shop.findUnique({
    where: { id: user.shopId }
  });

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white">ਜੀ ਆਇਆਂ ਨੂੰ! (Welcome to PRMS)</h1>
          <p className="text-gray-400 mt-2 text-sm">
            ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ਦੁਕਾਨ ਨੂੰ ਸੈੱਟਅੱਪ ਕਰਨ ਲਈ ਹੇਠਾਂ ਦਿੱਤੇ ਕਦਮ ਪੂਰੇ ਕਰੋ (Configure your shop context below)
          </p>
        </div>

        <SetupWizardForm
          shopId={shop?.id || ''}
          initialName={shop?.name || ''}
          initialPhone={shop?.phone || ''}
        />
      </div>
    </div>
  );
}
