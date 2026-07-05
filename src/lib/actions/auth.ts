'use server';

import { cookies, headers } from 'next/headers';
import { prisma } from '../../db/prisma';
import { Role, BusinessType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedDefaultCategories } from './categories';
import { verifyToken } from '../jwt';
import { RateLimiter } from '../RateLimiter';

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
  let clientIp = '127.0.0.1';
  try {
    const headerList = await headers();
    clientIp = headerList.get('x-forwarded-for') || headerList.get('x-real-ip') || '127.0.0.1';
  } catch {}

  // Limit login attempts to 10 requests per minute per IP + username combo
  const isRateAllowed = RateLimiter.isAllowed(`login:${clientIp}:${mobileOrUsername}`, 10, 60 * 1000);
  if (!isRateAllowed) {
    return {
      success: false,
      error: 'ਬਹੁਤ ਸਾਰੀਆਂ ਲੌਗਇਨ ਕੋਸ਼ਿਸ਼ਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਮਿੰਟ ਬਾਅਦ ਕੋਸ਼ਿਸ਼ ਕਰੋ (Too many login attempts. Please wait 1 minute.)'
    };
  }

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
          businessType: BusinessType.GENERAL_STORE,
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

      // Seed default categories for general store
      await seedDefaultCategories(prisma, shop.id, shop.businessType);
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

  // Extract client metadata for security auditing
  let clientUa = 'Unknown';
  try {
    const headerList = await headers();
    clientUa = headerList.get('user-agent') || 'Unknown';
  } catch {}

  // Check lockout condition
  if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
    return {
      success: false,
      error: 'ਬਾਰ-ਬਾਰ ਗਲਤ ਲੌਗਇਨ ਕਾਰਨ ਖਾਤਾ ਅਸਥਾਈ ਤੌਰ ਤੇ ਬੰਦ ਹੈ। (Account locked due to multiple failed logins. Please try again later.)'
    };
  }

  // Password Hashing Verification
  let isMatch = false;
  try {
    isMatch = await bcrypt.compare(passwordInput, user.password);
  } catch {
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
    const newAttempts = user.failedAttempts + 1;
    const lockedUntil = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: newAttempts,
        lockedUntil
      }
    });

    // Log detailed security failed attempt to AuditLog
    await prisma.auditLog.create({
      data: {
        shopId: user.shopId,
        userId: user.id,
        action: 'Failed Login Attempt',
        module: 'Auth',
        entity: 'User',
        details: `Failed login. Username: ${mobileOrUsername}. IP: ${clientIp}. User-Agent: ${clientUa}. Attempts: ${newAttempts}.${lockedUntil ? ' ACCOUNT LOCKED FOR 15 MINUTES.' : ''}`
      }
    });

    return { success: false, error: 'ਗਲਤ ਯੂਜ਼ਰਨੇਮ ਜਾਂ ਪਾਸਵਰਡ (Invalid credentials)' };
  }

  // Reset failed attempts on success
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedAttempts: 0,
      lockedUntil: null
    }
  });

  // Log successful login audit log
  await prisma.auditLog.create({
    data: {
      shopId: user.shopId,
      userId: user.id,
      action: 'Login',
      module: 'Auth',
      entity: 'User',
      details: `Successful login. IP: ${clientIp}. User-Agent: ${clientUa}`
    }
  });

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
  // 1. Try Authorization header first
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const session = await verifyToken(token);
      if (session) {
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
        if (dbUser) {
          return {
            ...session,
            mobile: dbUser.mobile,
            shopName: dbUser.shop.name,
            printerType: dbUser.shop.settings?.printerType || 'THERMAL_80',
          };
        }
      }
    }
  } catch {
    // Ignore error if headers() is unavailable in static generation contexts
  }

  // 2. Fall back to session cookie
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie || !sessionCookie.value) {
      return null;
    }

    const session = JSON.parse(sessionCookie.value) as UserSession;

    // Validate user exists in database to prevent stale session desyncs (e.g. after DB reset)
    const dbUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        shopId: true,
        mobile: true,
        role: true,
        shop: {
          select: {
            name: true,
            businessType: true,
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

    let activeShopId = dbUser.shopId;
    let activeRole = dbUser.role;
    let activeName = session.name;
    let activeShopName = dbUser.shop.name;
    let activeBusinessType = dbUser.shop.businessType;
    let activePrinterType = dbUser.shop.settings?.printerType || 'THERMAL_80';

    if (dbUser.role === Role.SUPER_ADMIN) {
      const impCookie = cookieStore.get('impersonatedShopId');
      if (impCookie && impCookie.value) {
        const targetShop = await prisma.shop.findUnique({
          where: { id: impCookie.value },
          select: {
            name: true,
            businessType: true,
            settings: { select: { printerType: true } }
          }
        });
        if (targetShop) {
          activeShopId = impCookie.value;
          activeRole = Role.VIEW_ONLY; // Force read-only troubleshoot mode
          activeName = `Super Admin (Impersonating)`;
          activeShopName = targetShop.name;
          activeBusinessType = targetShop.businessType;
          activePrinterType = targetShop.settings?.printerType || 'THERMAL_80';
        }
      }
    }

    return {
      userId: dbUser.id,
      name: activeName,
      role: activeRole,
      shopId: activeShopId,
      businessType: activeBusinessType,
      mobile: dbUser.mobile,
      shopName: activeShopName,
      printerType: activePrinterType,
    };
  } catch {
    return null;
  }
}

export async function impersonateShopAction(targetShopId: string | null): Promise<{ success: boolean }> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    if (!sessionCookie || !sessionCookie.value) {
      return { success: false };
    }

    const session = JSON.parse(sessionCookie.value) as UserSession;
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true }
    });

    if (!user || user.role !== Role.SUPER_ADMIN) {
      return { success: false };
    }

    if (targetShopId) {
      cookieStore.set('impersonatedShopId', targetShopId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 2, // 2 hours troubleshoot window
      });
    } else {
      cookieStore.delete('impersonatedShopId');
    }

    return { success: true };
  } catch (err) {
    console.error('Impersonate Shop Action Error:', err);
    return { success: false };
  }
}
