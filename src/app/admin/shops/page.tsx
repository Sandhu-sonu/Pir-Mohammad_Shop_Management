import React from 'react';
import { prisma } from '@/db/prisma';
import ShopListTable from './ShopListTable';

export default async function AdminShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = params.search || '';
  const status = params.status || '';
  const page = parseInt(params.page || '1', 10);
  const limit = 10;
  const skip = (page - 1) * limit;

  // Build query condition
  const whereCondition: any = {
    id: { not: 'admin-system-shop-id' }
  };

  if (search) {
    whereCondition.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      {
        users: {
          some: {
            role: 'OWNER',
            name: { contains: search, mode: 'insensitive' }
          }
        }
      }
    ];
  }

  if (status) {
    whereCondition.subscription = {
      status: status
    };
  }

  const [shops, totalCount] = await Promise.all([
    prisma.shop.findMany({
      where: whereCondition,
      include: {
        subscription: { include: { plan: true } },
        _count: {
          select: {
            products: { where: { isDeleted: false } },
            sales: true,
            customers: { where: { isDeleted: false } },
            suppliers: { where: { isDeleted: false } },
            users: { where: { status: 'ACTIVE' } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.shop.count({ where: whereCondition })
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Tenant Shops Management / ਦੁਕਾਨਾਂ ਦੀ ਸੂਚੀ</h2>
        <p className="text-gray-400 text-sm mt-1">Manage billing status, suspension lockouts, and impersonate targets</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <ShopListTable
          initialShops={shops.map(s => ({
            id: s.id,
            name: s.name,
            phone: s.phone || 'N/A',
            isSuspended: s.isSuspended,
            planName: s.subscription?.plan.name || 'No Plan',
            status: s.subscription?.status || 'INACTIVE',
            stats: {
              products: s._count.products,
              sales: s._count.sales,
              customers: s._count.customers,
              suppliers: s._count.suppliers,
              users: s._count.users
            }
          }))}
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          currentSearch={search}
          currentStatus={status}
        />
      </div>
    </div>
  );
}

