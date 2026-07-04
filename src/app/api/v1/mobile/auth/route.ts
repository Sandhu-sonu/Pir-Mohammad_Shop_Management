import { NextResponse } from 'next/server';
import { prisma } from '@/db/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/jwt';
import { Role } from '@prisma/client';
import { RateLimiter } from '@/lib/RateLimiter';

export async function POST(request: Request) {
  try {
    const { mobile, password } = await request.json();
    if (!mobile || !password) {
      return NextResponse.json({ success: false, error: 'Mobile and password are required' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    
    // Rate limit check
    const isRateAllowed = RateLimiter.isAllowed(`api-auth:${ip}:${mobile}`, 10, 60 * 1000);
    if (!isRateAllowed) {
      return NextResponse.json({ success: false, error: 'Too many login attempts. Please wait 1 minute.' }, { status: 429 });
    }

    // Retrieve user (restrict to OWNER role only for Mobile Phase 1)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { mobile: mobile },
          { name: mobile }
        ],
        role: Role.OWNER
      },
      include: {
        shop: { include: { settings: true } }
      }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'Owner account not found or access denied' }, { status: 401 });
    }

    // Lockout check
    if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
      return NextResponse.json({ success: false, error: 'Account locked due to multiple failed logins. Try again later.' }, { status: 403 });
    }

    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.password);
    } catch (err) {}

    // Migrated password fallback
    if (!isMatch && password === user.password) {
      isMatch = true;
    }

    if (!isMatch) {
      const newAttempts = user.failedAttempts + 1;
      const lockedUntil = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: newAttempts, lockedUntil }
      });

      // Audit log failed attempt
      const userAgent = request.headers.get('user-agent') || 'Unknown';
      await prisma.auditLog.create({
        data: {
          shopId: user.shopId,
          userId: user.id,
          action: 'Failed Login Attempt (Mobile API)',
          module: 'Auth',
          entity: 'User',
          details: `Failed login via Mobile API. IP: ${ip}. User-Agent: ${userAgent}. Attempts: ${newAttempts}.${lockedUntil ? ' ACCOUNT LOCKED FOR 15 MINUTES.' : ''}`
        }
      });

      return NextResponse.json({ success: false, error: 'Invalid mobile or password' }, { status: 401 });
    }

    // On success: reset attempts & log successful login
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null }
    });
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    await prisma.auditLog.create({
      data: {
        shopId: user.shopId,
        userId: user.id,
        action: 'Login (Mobile API)',
        module: 'Auth',
        entity: 'User',
        details: `Successful login via Mobile API. IP: ${ip}. User-Agent: ${userAgent}`
      }
    });

    // Sign session token
    const token = await signToken({
      userId: user.id,
      name: user.name,
      role: user.role,
      shopId: user.shopId,
      mobile: user.mobile
    });

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        shopId: user.shopId,
        mobile: user.mobile,
        shopName: user.shop.name
      }
    });
  } catch (err: any) {
    console.error('Mobile Auth API Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
