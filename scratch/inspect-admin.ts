import 'dotenv/config';
import { prisma } from '../src/db/prisma';
import bcrypt from 'bcryptjs';

async function inspectAdmin() {
  const user = await prisma.user.findUnique({
    where: { mobile: '9999999999' }
  });

  if (!user) {
    console.log("❌ Super Admin user '9999999999' NOT found in the database!");
    return;
  }

  console.log("✔ Found user:", {
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    role: user.role,
    adminRole: user.adminRole,
    shopId: user.shopId
  });

  // Verify password comparison
  const isMatch = await bcrypt.compare('adminpassword123', user.password);
  console.log(`✔ Password 'adminpassword123' comparison match: ${isMatch}`);
}

inspectAdmin()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
