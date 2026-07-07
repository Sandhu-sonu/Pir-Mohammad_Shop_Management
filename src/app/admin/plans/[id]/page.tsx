import React from 'react';
import { prisma } from '@/db/prisma';
import { notFound } from 'next/navigation';
import EditPlanForm from './EditPlanForm';
import Link from 'next/link';

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const plan = await prisma.plan.findUnique({
    where: { id },
    include: {
      features: {
        include: { feature: true },
        orderBy: { feature: { name: 'asc' } }
      }
    }
  });

  if (!plan) {
    notFound();
  }

  // Format features data for the client form
  const formattedFeatures = plan.features.map((pf) => ({
    id: pf.id,
    featureId: pf.featureId,
    featureName: pf.feature.name,
    featureCode: pf.feature.code,
    enabled: pf.enabled,
    limitType: pf.limitType,
    limitValue: pf.limitValue
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/plans"
          className="text-xs text-[#FF6B6B] hover:underline font-bold flex items-center gap-1.5 uppercase tracking-wider"
        >
          ← Back to Plans / ਪਲਾਨ ਸੰਰਚਨਾ
        </Link>
        <h2 className="text-2xl font-bold text-white mt-2">Edit Plan Configuration / ਪਲਾਨ ਸੰਰਚਨਾ ਬਦਲੋ</h2>
        <p className="text-gray-400 text-sm mt-0.5">Modify pricing structure, billing frequency, and active quota limits for: {plan.name}</p>
      </div>

      <EditPlanForm
        plan={{
          id: plan.id,
          name: plan.name,
          price: plan.price.toNumber(),
          billingPeriod: plan.billingPeriod
        }}
        features={formattedFeatures}
      />
    </div>
  );
}
