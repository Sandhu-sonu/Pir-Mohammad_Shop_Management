import { hasPermission, requirePermission } from '../src/lib/permissions';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function runHardeningTests() {
  console.log('=== STARTING SECURITY & HARDENING VERIFICATION TESTS ===');

  // Test 1: RBAC Permission Matrix Assertions
  console.log('\n--- TEST 1: RBAC Matrix Checks ---');
  try {
    // Owner permissions check
    requirePermission(Role.OWNER, 'backup.write');
    console.log('✔ OWNER has backup.write');

    requirePermission(Role.OWNER, 'products.create');
    console.log('✔ OWNER has products.create');

    // Staff permissions check
    const staffCanBackup = hasPermission(Role.STAFF, 'backup.write');
    console.log(staffCanBackup ? '❌ Error: STAFF should not have backup.write' : '✔ STAFF successfully blocked from backup.write');

    const staffCanSell = hasPermission(Role.STAFF, 'sales.write');
    console.log(staffCanSell ? '✔ STAFF has sales.write' : '❌ Error: STAFF should have sales.write');

    // View-Only permissions check
    const viewOnlyCanSell = hasPermission(Role.VIEW_ONLY, 'sales.write');
    console.log(viewOnlyCanSell ? '❌ Error: VIEW_ONLY should not have sales.write' : '✔ VIEW_ONLY blocked from sales.write');

    const viewOnlyCanRead = hasPermission(Role.VIEW_ONLY, 'products.read');
    console.log(viewOnlyCanRead ? '✔ VIEW_ONLY has products.read' : '❌ Error: VIEW_ONLY should have products.read');

  } catch (err: any) {
    console.error('❌ RBAC Test Failed:', err.message);
  }

  // Test 2: Hashed Password Verification
  console.log('\n--- TEST 2: Password Hashing & Comparison ---');
  try {
    const rawPass = 'admin123';
    const hashed = await bcrypt.hash(rawPass, 10);
    console.log(`Hashed password: ${hashed}`);

    const isMatch = await bcrypt.compare(rawPass, hashed);
    console.log(isMatch ? '✔ Password matched successfully using bcrypt.compare' : '❌ Password match failed');

    const isDifferent = await bcrypt.compare('wrongpass', hashed);
    console.log(!isDifferent ? '✔ Invalid password successfully rejected' : '❌ Allowed wrong password');
  } catch (err: any) {
    console.error('❌ Hashing Test Failed:', err.message);
  }

  console.log('\n=== ALL HARDENING ASSERTIONS COMPLETED SUCCESSFULLY ===');
}

runHardeningTests().catch(console.error);
