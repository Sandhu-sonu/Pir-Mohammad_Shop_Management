import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCookieSecureFlag } from '@/lib/actions/auth';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (sessionCookie && sessionCookie.value) {
      const secure = await getCookieSecureFlag();
      // Re-set cookie to slide expiration window (7 days)
      cookieStore.set('session', sessionCookie.value, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
      });
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ success: false, error: 'No active session' }, { status: 401 });
  } catch (err) {
    console.error('Session Ping Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
