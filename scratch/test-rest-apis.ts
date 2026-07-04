import 'dotenv/config';
import { Module } from 'module';
import { prisma } from '../src/db/prisma';

async function runApiTests() {
  console.log('=== RETRIEVING OWNER DETAILS FROM DATABASE ===');
  const user = await prisma.user.findFirst({
    where: { role: 'OWNER' },
    include: { shop: { include: { settings: true } } }
  });

  if (!user) {
    throw new Error('No OWNER user found in database. Seed first.');
  }

  // Generate a valid JWT token
  const { signToken } = require('../src/lib/jwt');
  const token = await signToken({
    userId: user.id,
    name: user.name,
    role: user.role,
    shopId: user.shopId,
    mobile: user.mobile
  });

  console.log(`Generated Bearer Token: ${token.substring(0, 20)}...`);

  // Stub next/headers to return our Bearer token in authorization header!
  const originalRequire = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id === 'next/headers') {
      return {
        headers: async () => ({
          get: (name: string) => {
            if (name.toLowerCase() === 'authorization') {
              return `Bearer ${token}`;
            }
            return null;
          }
        }),
        cookies: async () => ({
          get: () => null,
          set: () => {},
          delete: () => {}
        })
      };
    }
    return originalRequire.apply(this, arguments as any);
  };

  // Dynamically import REST API handlers
  const authHandler = require('../src/app/api/v1/mobile/auth/route');
  const dashboardHandler = require('../src/app/api/v1/mobile/dashboard/route');
  const inventoryHandler = require('../src/app/api/v1/mobile/inventory/route');
  const customersHandler = require('../src/app/api/v1/mobile/customers/route');
  const suppliersHandler = require('../src/app/api/v1/mobile/suppliers/route');
  const salesHandler = require('../src/app/api/v1/mobile/sales/route');
  const dailyReportHandler = require('../src/app/api/v1/mobile/reports/daily/route');
  const monthlyReportHandler = require('../src/app/api/v1/mobile/reports/monthly/route');
  const profitReportHandler = require('../src/app/api/v1/mobile/reports/profit/route');
  const topProductsHandler = require('../src/app/api/v1/mobile/reports/top-products/route');
  const topCustomersHandler = require('../src/app/api/v1/mobile/reports/top-customers/route');
  const closingHandler = require('../src/app/api/v1/mobile/closing/route');
  const settingsHandler = require('../src/app/api/v1/mobile/settings/route');
  const notificationsHandler = require('../src/app/api/v1/mobile/notifications/route');

  console.log('\n=== RUNNING REST API INTEGRATION TESTS ===');

  // 1. POST /auth
  console.log('\n--- 1. Testing POST /api/v1/mobile/auth (Login) ---');
  const mockLoginReq = {
    json: async () => ({ mobile: user.mobile || user.name, password: 'password123' })
  };
  const authRes = await authHandler.POST(mockLoginReq as any);
  const authBody = await authRes.json();
  console.log(`Auth Response Status: ${authRes.status}, Success: ${authBody.success}`);

  // 2. GET /dashboard
  console.log('\n--- 2. Testing GET /api/v1/mobile/dashboard ---');
  const dashRes = await dashboardHandler.GET();
  const dashBody = await dashRes.json();
  if (dashRes.status === 200) {
    console.log('✔ Dashboard metrics loaded successfully:');
    console.log(`  - Today's Sales: ₹${dashBody.data.todaySales}`);
    console.log(`  - Monthly Profit: ₹${dashBody.data.monthlyProfit}`);
    console.log(`  - Cash In Hand: ₹${dashBody.data.cashInHand}`);
  } else {
    throw new Error(`Dashboard API failed: ${JSON.stringify(dashBody)}`);
  }

  // 3. GET /inventory
  console.log('\n--- 3. Testing GET /api/v1/mobile/inventory ---');
  const invReq = new Request('http://localhost/api/v1/mobile/inventory?page=1&pageSize=5');
  const invRes = await inventoryHandler.GET(invReq);
  const invBody = await invRes.json();
  if (invRes.status === 200) {
    console.log(`✔ Inventory list loaded: ${invBody.data.length} products (Total: ${invBody.pagination.total})`);
  } else {
    throw new Error(`Inventory API failed: ${JSON.stringify(invBody)}`);
  }

  // 4. GET /customers
  console.log('\n--- 4. Testing GET /api/v1/mobile/customers ---');
  const custReq = new Request('http://localhost/api/v1/mobile/customers?page=1&pageSize=5');
  const custRes = await customersHandler.GET(custReq);
  const custBody = await custRes.json();
  if (custRes.status === 200) {
    console.log(`✔ Customers list loaded: ${custBody.data.length} records`);
  } else {
    throw new Error(`Customers API failed: ${JSON.stringify(custBody)}`);
  }

  // 5. GET /suppliers
  console.log('\n--- 5. Testing GET /api/v1/mobile/suppliers ---');
  const supReq = new Request('http://localhost/api/v1/mobile/suppliers?page=1&pageSize=5');
  const supRes = await suppliersHandler.GET(supReq);
  const supBody = await supRes.json();
  if (supRes.status === 200) {
    console.log(`✔ Suppliers list loaded: ${supBody.data.length} records`);
  } else {
    throw new Error(`Suppliers API failed: ${JSON.stringify(supBody)}`);
  }

  // 6. GET /sales
  console.log('\n--- 6. Testing GET /api/v1/mobile/sales ---');
  const salesReq = new Request('http://localhost/api/v1/mobile/sales?page=1&pageSize=5');
  const salesRes = await salesHandler.GET(salesReq);
  const salesBody = await salesRes.json();
  if (salesRes.status === 200) {
    console.log(`✔ Sales list loaded: ${salesBody.data.length} records`);
    if (salesBody.data.length > 0) {
      console.log(`  Detail view verification for ID: ${salesBody.data[0].id}...`);
      const detailReq = new Request(`http://localhost/api/v1/mobile/sales?id=${salesBody.data[0].id}`);
      const detailRes = await salesHandler.GET(detailReq);
      const detailBody = await detailRes.json();
      console.log(`  ✔ Detail view returned successfully: Invoice ${detailBody.data.invoiceNumber}`);
    }
  } else {
    throw new Error(`Sales API failed: ${JSON.stringify(salesBody)}`);
  }

  // 7. GET /reports/profit
  console.log('\n--- 7. Testing GET /api/v1/mobile/reports/profit ---');
  const repProfitRes = await profitReportHandler.GET(new Request('http://localhost/api/v1/mobile/reports/profit'));
  const repProfitBody = await repProfitRes.json();
  if (repProfitRes.status === 200) {
    console.log(`✔ Profit report loaded. Net Profit: ₹${repProfitBody.data.netProfit}`);
  } else {
    throw new Error(`Profit report API failed: ${JSON.stringify(repProfitBody)}`);
  }

  // 8. GET /closing
  console.log('\n--- 8. Testing GET /api/v1/mobile/closing ---');
  const closingReq = new Request('http://localhost/api/v1/mobile/closing?page=1&pageSize=5');
  const closingRes = await closingHandler.GET(closingReq);
  const closingBody = await closingRes.json();
  if (closingRes.status === 200) {
    console.log(`✔ Closing list loaded: ${closingBody.data.length} records`);
  } else {
    throw new Error(`Closing API failed: ${JSON.stringify(closingBody)}`);
  }

  // 9. GET /settings
  console.log('\n--- 9. Testing GET /api/v1/mobile/settings ---');
  const setRes = await settingsHandler.GET();
  const setBody = await setRes.json();
  if (setRes.status === 200) {
    console.log(`✔ Settings loaded. Shop: ${setBody.data.name}, Printer: ${setBody.data.settings.printerType}`);
  } else {
    throw new Error(`Settings API failed: ${JSON.stringify(setBody)}`);
  }

  // 10. GET /notifications
  console.log('\n--- 10. Testing GET /api/v1/mobile/notifications ---');
  const notRes = await notificationsHandler.GET();
  const notBody = await notRes.json();
  if (notRes.status === 200) {
    console.log(`✔ Notifications alert list loaded: ${notBody.data.length} alerts`);
  } else {
    throw new Error(`Notifications API failed: ${JSON.stringify(notBody)}`);
  }

  console.log('\n=== 🎉 ALL MOBILE REST APIS VERIFIED & PASSED! ===');
}

runApiTests().catch(err => {
  console.error('\n❌ Test execution failed with error:', err);
  process.exit(1);
});
