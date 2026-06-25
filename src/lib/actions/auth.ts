'use server';

import { cookies } from 'next/headers';
import { prisma } from '../../db/prisma';
import { Role } from '@prisma/client';

export interface UserSession {
  userId: string;
  name: string;
  role: Role;
  shopId: string;
}

export async function login(mobileOrUsername: string, passwordInput: string): Promise<{ success: boolean; error?: string }> {
  // Hardcoded default "admin" / "admin123" support as fallback
  if (mobileOrUsername === 'admin' && passwordInput === 'admin123') {
    // Find the first shop in the system or create one if none exists
    let shop = await prisma.shop.findFirst();
    if (!shop) {
      shop = await prisma.shop.create({
        data: {
          name: 'Sher-E-Punjab Retail',
          address: 'G.T. Road, Jalandhar, Punjab',
          gst: '03AAAAA1111A1Z1',
          currency: 'INR',
        },
      });
      // Also create default settings
      await prisma.settings.create({
        data: {
          shopId: shop.id,
          language: 'pa',
          theme: 'light',
          lowStockAlert: true,
        },
      });
    }

    // Find or create admin user in DB
    let user = await prisma.user.findFirst({
      where: { role: Role.OWNER },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: 'Baljinder Singh (Admin)',
          mobile: 'admin',
          password: 'admin123',
          role: Role.OWNER,
          shopId: shop.id,
        },
      });
    }

    const sessionData: UserSession = {
      userId: user.id,
      name: user.name,
      role: user.role,
      shopId: user.shopId,
    };

    const cookieStore = await cookies();
    cookieStore.set('session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return { success: true };
  }

  // Database lookup for other credentials
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { mobile: mobileOrUsername },
        { name: mobileOrUsername }
      ],
      password: passwordInput, // In production, use hash comparisons
    },
    include: { shop: true },
  });

  if (!user) {
    return { success: false, error: 'ਗਲਤ ਯੂਜ਼ਰਨੇਮ ਜਾਂ ਪਾਸਵਰਡ (Invalid credentials)' };
  }

  const sessionData: UserSession = {
    userId: user.id,
    name: user.name,
    role: user.role,
    shopId: user.shopId,
  };

  const cookieStore = await cookies();
  cookieStore.set('session', JSON.stringify(sessionData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return { success: true };
}

export async function logout(): Promise<{ success: boolean }> {
  const cookieStore = await cookies();
  cookieStore.delete('session');
  return { success: true };
}

export async function getCurrentUser(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  try {
    return JSON.parse(sessionCookie.value) as UserSession;
  } catch {
    return null;
  }
}
