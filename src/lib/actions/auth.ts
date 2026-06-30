'use server';

import { cookies } from 'next/headers';
import { prisma } from '../../db/prisma';
import { Role, BusinessType } from '@prisma/client';
import bcrypt from 'bcryptjs';

export interface UserSession {
  userId: string;
  name: string;
  role: Role;
  shopId: string;
  businessType: BusinessType;
  mobile?: string;
  shopName?: string;
  printerType?: string;
}

export async function login(mobileOrUsername: string, passwordInput: string): Promise<{ success: boolean; error?: string }> {
  // Hardcoded default "admin" / "admin123" support as fallback
  if (mobileOrUsername === 'admin' && passwordInput === 'admin123') {
    // Find the first shop in the system or create one if none exists
    let shop = await prisma.shop.findFirst({
      include: { settings: true },
    });
    if (!shop) {
      shop = await prisma.shop.create({
        data: {
          name: 'Sher-E-Punjab Retail',
          address: 'G.T. Road, Jalandhar, Punjab',
          gst: '03AAAAA1111A1Z1',
          currency: 'INR',
        },
        include: { settings: true },
      });
      // Also create default settings
      const settings = await prisma.settings.create({
        data: {
          shopId: shop.id,
          language: 'pa',
          theme: 'light',
          lowStockAlert: true,
        },
      });
      shop.settings = settings;
    }

    // Find or create admin user in DB
    let user = await prisma.user.findFirst({
      where: { role: Role.OWNER },
    });

    if (!user) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      user = await prisma.user.create({
        data: {
          name: 'Baljinder Singh (Admin)',
          mobile: 'admin',
          password: hashedPassword,
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
      businessType: shop.businessType,
      mobile: user.mobile,
      shopName: shop.name,
      printerType: shop.settings?.printerType || 'THERMAL_80',
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
    },
    include: { 
      shop: {
        include: { settings: true }
      }
    },
  });

  if (!user) {
    return { success: false, error: 'ਗਲਤ ਯੂਜ਼ਰਨੇਮ ਜਾਂ ਪਾਸਵਰਡ (Invalid credentials)' };
  }

  // Password Hashing Verification
  let isMatch = false;
  try {
    isMatch = await bcrypt.compare(passwordInput, user.password);
  } catch (err) {
    // Ignore comparison throw
  }

  // Plaintext Password Migration fallback
  if (!isMatch && passwordInput === user.password) {
    const hashedPassword = await bcrypt.hash(passwordInput, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
    isMatch = true;
  }

  if (!isMatch) {
    return { success: false, error: 'ਗਲਤ ਯੂਜ਼ਰਨੇਮ ਜਾਂ ਪਾਸਵਰਡ (Invalid credentials)' };
  }

  const sessionData: UserSession = {
    userId: user.id,
    name: user.name,
    role: user.role,
    shopId: user.shopId,
    businessType: user.shop.businessType,
    mobile: user.mobile,
    shopName: user.shop.name,
    printerType: user.shop.settings?.printerType || 'THERMAL_80',
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
    const session = JSON.parse(sessionCookie.value) as UserSession;

    // Validate user exists in database to prevent stale session desyncs (e.g. after DB reset)
    const dbUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        shopId: true,
        mobile: true,
        shop: {
          select: {
            name: true,
            settings: {
              select: { printerType: true }
            }
          }
        }
      },
    });

    if (!dbUser) {
      // Clear cookie if user no longer exists
      cookieStore.delete('session');
      return null;
    }

    return {
      ...session,
      mobile: dbUser.mobile,
      shopName: dbUser.shop.name,
      printerType: dbUser.shop.settings?.printerType || 'THERMAL_80',
    };
  } catch {
    return null;
  }
}
