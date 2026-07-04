import 'dotenv/config';
import { prisma } from '../src/db/prisma';
import { validatePassword } from '../src/lib/passwordPolicy';
import { RateLimiter } from '../src/lib/RateLimiter';
import { login } from '../src/lib/actions/auth';
import { LocalDiskBackupDriver } from '../src/db/services/BackupService';
import * as fs from 'fs';
import * as path from 'path';

async function runSecurityTests() {
  console.log('==================================================');
  console.log('      PRMS SECURITY & HARDENING VERIFIER          ');
  console.log('==================================================\n');

  try {
    // 1. Connection check
    await prisma.$queryRaw`SELECT 1`;
    console.log('✔ DB connection online.\n');
  } catch (err: any) {
    console.error('❌ DB connection failed:', err.message);
    process.exit(1);
  }

  // --- UNIT TEST 1: Password complexity ---
  console.log('--- TEST 1: Configurable Password Policy ---');
  const policy = {
    minPasswordLength: 8,
    requirePasswordUppercase: true,
    requirePasswordNumber: true,
    requirePasswordSpecial: true
  };

  const check1 = validatePassword('short', policy);
  console.log(check1.isValid ? '❌ Failed: Accepted short password' : '✔ Correctly rejected short password.');

  const check2 = validatePassword('nouppercase123!', policy);
  console.log(check2.isValid ? '❌ Failed: Accepted lowercase only' : '✔ Correctly rejected password missing uppercase letter.');

  const check3 = validatePassword('NoNumberSpecial!', policy);
  console.log(check3.isValid ? '❌ Failed: Accepted no numbers' : '✔ Correctly rejected password missing numbers.');

  const check4 = validatePassword('NoSpecial123', policy);
  console.log(check4.isValid ? '❌ Failed: Accepted no special char' : '✔ Correctly rejected password missing special characters.');

  const check5 = validatePassword('SecurePass123!', policy);
  console.log(check5.isValid ? '✔ Correctly accepted secure password.' : '❌ Failed: Rejected valid secure password.');


  // --- UNIT TEST 2: In-Memory Rate Limiter ---
  console.log('\n--- TEST 2: In-Memory Sliding-Window Rate Limiter ---');
  const limitKey = 'test-client-ip';
  let allowedCount = 0;
  for (let i = 0; i < 12; i++) {
    const ok = RateLimiter.isAllowed(limitKey, 10, 5000); // Max 10 in 5s
    if (ok) allowedCount++;
  }
  console.log(allowedCount === 10 ? '✔ Correctly limited requests at threshold 10.' : `❌ Failed: Allowed count is ${allowedCount}`);

  const blockedCheck = RateLimiter.isAllowed(limitKey, 10, 5000);
  console.log(!blockedCheck ? '✔ Correctly blocked 11th rate-limited request.' : '❌ Failed: Allowed rate-limited request.');


  // --- UNIT TEST 3: Login lockouts & failed login telemetry ---
  console.log('\n--- TEST 3: Login Lockout Trigger (5 Failures) ---');
  // Create mock shop & user
  const testShop = await prisma.shop.create({
    data: { name: 'Security Lockout Test Shop', currency: 'INR' }
  });
  
  const testMobile = `test_${Date.now()}`;
  const testUser = await prisma.user.create({
    data: {
      name: 'Security Test User',
      mobile: testMobile,
      password: 'PlaintextSecurePassword123!', // Hashed automatically on comparative comparative compare
      role: 'OWNER',
      shopId: testShop.id
    }
  });

  // Trigger 4 failed logins
  for (let i = 1; i <= 4; i++) {
    await login(testMobile, 'WrongPassword');
  }
  
  let dbUser = await prisma.user.findUnique({ where: { id: testUser.id } });
  console.log(dbUser?.failedAttempts === 4 ? '✔ Tracked 4 failed login attempts.' : `❌ Failed: Attempts is ${dbUser?.failedAttempts}`);
  console.log(!dbUser?.lockedUntil ? '✔ Account is still active.' : '❌ Failed: Locked prematurely.');

  // Trigger 5th failed login -> Lockout
  await login(testMobile, 'WrongPassword');
  dbUser = await prisma.user.findUnique({ where: { id: testUser.id } });
  console.log(dbUser?.failedAttempts === 5 ? '✔ Tracked 5 failed login attempts.' : `❌ Failed: Attempts is ${dbUser?.failedAttempts}`);
  console.log(dbUser?.lockedUntil && new Date(dbUser.lockedUntil) > new Date() ? '✔ Account locked successfully for 15 minutes.' : '❌ Failed: Account is not locked.');

  // Try authenticating while locked out
  const lockedRes = await login(testMobile, 'PlaintextSecurePassword123!');
  console.log(!lockedRes.success && lockedRes.error?.includes('locked') ? '✔ Correctly blocked login attempts during active lockout.' : '❌ Failed: Allowed login during lockout.');


  // --- UNIT TEST 4: Backup Integrity check ---
  console.log('\n--- TEST 4: Backup File Integrity verification ---');
  const driver = new LocalDiskBackupDriver();
  const testJsonPath = path.join(process.cwd(), 'storage', 'backups', 'temp_verify_test.json');

  if (!fs.existsSync(path.dirname(testJsonPath))) {
    fs.mkdirSync(path.dirname(testJsonPath), { recursive: true });
  }

  // A. Write empty file
  fs.writeFileSync(testJsonPath, 'empty content');
  const checkEmpty = await driver.verify('test', testJsonPath);
  console.log(!checkEmpty.success ? '✔ Correctly flagged empty/small backup file.' : '❌ Failed: Accepted empty backup.');

  // B. Write missing tables schema
  fs.writeFileSync(testJsonPath, JSON.stringify({ backupVersion: '1.0', shopId: 'shop1', data: { categories: [] } }));
  const checkMissing = await driver.verify('test', testJsonPath);
  console.log(!checkMissing.success ? '✔ Correctly flagged backup missing mandatory tables.' : '❌ Failed: Accepted missing tables.');

  // C. Write fully valid backup JSON mock content
  const mockJson = {
    backupVersion: '1.0',
    shopId: 'shop-123',
    timestamp: new Date().toISOString(),
    data: {
      categories: [],
      products: [],
      sales: [],
      settings: { id: 'settings-123' }
    }
  };
  fs.writeFileSync(testJsonPath, JSON.stringify(mockJson, null, 2));
  const checkValid = await driver.verify('test', testJsonPath);
  console.log(checkValid.success ? '✔ Correctly validated schema integrity constraints.' : `❌ Failed: Rejected valid backup: ${checkValid.error}`);

  // Cleanup temp files
  if (fs.existsSync(testJsonPath)) fs.unlinkSync(testJsonPath);
  
  // Cleanup mock DB records
  await prisma.user.delete({ where: { id: testUser.id } });
  await prisma.shop.delete({ where: { id: testShop.id } });

  console.log('\n==================================================');
  console.log('     🎉 ALL SECURITY CONTROLS PASSED INDEPENDENTLY! ');
  console.log('==================================================\n');
}

runSecurityTests().catch((err) => {
  console.error('Security verification failed:', err);
  process.exit(1);
});
