import 'dotenv/config';
import AdminBillingPage from '../src/app/admin/billing/page';

async function testRender() {
  console.log("⚡ Triggering AdminBillingPage render simulation...");
  try {
    const jsx = await AdminBillingPage();
    console.log("✔ AdminBillingPage rendered successfully without errors!");
  } catch (err: any) {
    console.error("❌ RENDER EXCEPTION DETECTED:");
    console.error(err.stack || err);
  }
}

testRender()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Unhanlded crash:", err);
    process.exit(1);
  });
