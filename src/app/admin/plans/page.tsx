import React from 'react';
import { prisma } from '@/db/prisma';
import { BillingPeriod } from '@prisma/client';

export default async function AdminPlansPage() {
  const plans = await prisma.plan.findMany({
    include: {
      features: {
        include: { feature: true }
      }
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">SaaS Plans & Feature Limits / ਪਲਾਨ ਸੰਰਚਨਾ</h2>
        <p className="text-gray-400 text-sm mt-1">Configure pricing tiers, active features, and database threshold quotas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p) => (
          <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <span className="inline-block bg-primary/10 text-primary text-xs font-extrabold px-2.5 py-1 rounded-full uppercase" style={{ color: '#FF6B6B', backgroundColor: 'rgba(255, 107, 107, 0.1)' }}>
                  Active Tier
                </span>
                <h3 className="text-xl font-bold text-white mt-2">{p.name}</h3>
                <p className="text-3xl font-extrabold text-white mt-1">₹{p.price.toNumber()} <span className="text-xs text-gray-500 font-normal">/ {p.billingPeriod}</span></p>
              </div>

              <div className="border-t border-gray-800 pt-4 space-y-3">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Features & Limits:</p>
                {p.features.map((pf) => (
                  <div key={pf.id} className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">{pf.feature.name}</span>
                    <span className={`text-xs font-bold ${pf.enabled ? 'text-green-400' : 'text-gray-600'}`}>
                      {pf.enabled ? (
                        pf.limitValue > 0 ? `Limit: ${pf.limitValue} (${pf.limitType})` : 'Unlimited ✔'
                      ) : 'Disabled ✖'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 rounded-xl text-xs mt-6 transition duration-200 border border-gray-700">
              Edit Plan Configurations (Configuration Only)
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
