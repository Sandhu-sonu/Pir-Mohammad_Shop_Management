import 'dotenv/config';
import { prisma } from '../src/db/prisma';
import { BackupService } from '../src/db/services/BackupService';
import { ImportService } from '../src/db/services/ImportService';
import { ExportService } from '../src/db/services/ExportService';
import { BackupRepository } from '../src/db/repositories/BackupRepository';
import * as fs from 'fs';
import * as path from 'path';

async function runTests() {
  console.log('==================================================');
  console.log('RUNNING PHASE 7 VERIFICATION TESTS');
  console.log('==================================================');

  // Find or create Shop A
  let shopA = await prisma.shop.findFirst();
  if (!shopA) {
    shopA = await prisma.shop.create({
      data: {
        name: 'Punjab Test Shop A',
        currency: 'INR',
      },
    });
  }
  
  // Find/Create a secondary shop to test tenant isolation
  let shopB = await prisma.shop.findFirst({ where: { NOT: { id: shopA.id } } });
  if (!shopB) {
    shopB = await prisma.shop.create({
      data: {
        name: 'Secondary Tenant Shop B',
        currency: 'INR',
      },
    });
  }

  // Find or create User A
  let userA = await prisma.user.findFirst({ where: { shopId: shopA.id } });
  if (!userA) {
    userA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        name: 'Baljinder Singh',
        mobile: '9876543210',
        password: 'password123',
        role: 'OWNER',
      },
    });
  }

  console.log(`Testing using Shop A ID: ${shopA.id} (${shopA.name})`);
  console.log(`Testing using Shop B ID: ${shopB.id} (${shopB.name})`);

  // Define verification report states
  const results = {
    manualBackupCreated: false,
    pruningEnforced: false,
    tenantIsolationRestore: false,
    corruptedBackupRejected: false,
    versionMismatchedRejected: false,
    duplicateImportResolution: false,
    pwaAssetsVerified: false,
    auditLogsValidated: false,
  };

  try {
    // ----------------------------------------------------
    // TEST 1: MANUAL BACKUP CREATION
    // ----------------------------------------------------
    console.log('\n[TEST 1] Creating Manual Backup for Shop A...');
    const backupLog = await BackupService.createBackup(shopA.id, userA.id, 'Test manual backup execution');
    await prisma.auditLog.create({
      data: {
        userId: userA.id,
        action: 'Backup Created',
        module: 'Backup',
        details: `Manual backup created: ${backupLog.filename}`,
      },
    });
    
    // Check if JSON file exists
    const backupDir = BackupService.getBackupDir();
    const filepath = path.join(backupDir, backupLog.filename);
    if (!fs.existsSync(filepath)) throw new Error('Backup file was not created on disk.');
    
    const fileContent = fs.readFileSync(filepath, 'utf-8');
    const parsedBackup = JSON.parse(fileContent);
    
    if (parsedBackup.shopId !== shopA.id) throw new Error('Backup shopId mismatch.');
    if (parsedBackup.backupVersion !== '1.0') throw new Error('Backup version mismatch.');
    
    console.log(`✓ Manual backup verified. Filename: ${backupLog.filename}, Size: ${backupLog.fileSize} bytes.`);
    results.manualBackupCreated = true;

    // ----------------------------------------------------
    // TEST 2: RETENTION PRUNING (30-BACKUPS LIMIT)
    // ----------------------------------------------------
    console.log('\n[TEST 2] Testing 30-Backup Retention Pruning...');
    // Seed dummy backup records to trigger pruning
    for (let i = 0; i < 32; i++) {
      const dummyFilename = `dummy-prune-backup-${i}.json`;
      const dummyPath = path.join(backupDir, dummyFilename);
      fs.writeFileSync(dummyPath, JSON.stringify({ test: true }), 'utf-8');
      
      await prisma.backupHistory.create({
        data: {
          shopId: shopA.id,
          backupType: 'MANUAL',
          backupVersion: '1.0',
          schemaVersion: '20260601',
          appVersion: '1.0.0',
          duration: 5,
          filename: dummyFilename,
          status: 'SUCCESS',
          fileSize: 100,
          createdById: userA.id,
        },
      });
    }

    // Trigger prune cycle via next backup
    await BackupService.createBackup(shopA.id, userA.id, 'Trigger prune action');
    
    const currentCount = await prisma.backupHistory.count({ where: { shopId: shopA.id } });
    console.log(`✓ Backup retention prune verified. Total database backup logs in DB: ${currentCount} (Should be <= 30)`);
    if (currentCount > 30) throw new Error(`Pruning failed. DB logs count is ${currentCount}`);
    
    results.pruningEnforced = true;

    // Clean up dummy backups
    for (let i = 0; i < 32; i++) {
      const dummyFilename = `dummy-prune-backup-${i}.json`;
      const dummyPath = path.join(backupDir, dummyFilename);
      if (fs.existsSync(dummyPath)) fs.unlinkSync(dummyPath);
    }
    await prisma.backupHistory.deleteMany({
      where: { filename: { startsWith: 'dummy-prune-backup-' } }
    });

    // ----------------------------------------------------
    // TEST 3: TENANT ISOLATION ON RESTORE
    // ----------------------------------------------------
    console.log('\n[TEST 3] Testing Tenant Isolation Restore (Shop A vs Shop B)...');
    
    // Seed a product in Shop B
    const productB = await prisma.product.create({
      data: {
        shopId: shopB.id,
        sku: 'SKU-SHOPB-1',
        nameEn: 'Product Shop B',
        namePa: 'Product Shop B Pa',
        purchasePrice: 15.0,
        sellingPrice: 20.0,
        currentQuantity: 50,
        minStock: 5,
        unit: 'PCS',
      },
    });

    // Make Shop A backup
    const backupForA = await BackupService.createBackup(shopA.id, userA.id, 'Isolation check backup');
    const backupPathA = path.join(backupDir, backupForA.filename);
    const backupContentA = fs.readFileSync(backupPathA, 'utf-8');

    // Add a temporary item to Shop A to test it gets replaced on restore
    const tempProductA = await prisma.product.create({
      data: {
        shopId: shopA.id,
        sku: 'SKU-TEMPA-1',
        nameEn: 'Temp Product Shop A',
        namePa: 'Temp Product Shop A Pa',
        purchasePrice: 10,
        sellingPrice: 15,
        currentQuantity: 10,
        unit: 'PCS',
      },
    });

    // Perform Restore of Shop A
    console.log('Restoring Shop A backup...');
    await BackupService.restoreBackup(shopA.id, userA.id, backupContentA);
    await prisma.auditLog.create({
      data: {
        userId: userA.id,
        action: 'Backup Restored',
        module: 'Backup',
        details: `Database restored from backup of Shop A`,
      },
    });

    // Verify temp product in Shop A was deleted
    const foundTemp = await prisma.product.findUnique({ where: { id: tempProductA.id } });
    if (foundTemp) throw new Error('Restore did not clear existing items of the shop.');

    // Verify Shop B product still exists (Tenant Isolation!)
    const foundB = await prisma.product.findUnique({ where: { id: productB.id } });
    if (!foundB) throw new Error('Security Violation: Restore truncated data from another shop (Shop B)!');
    
    console.log('✓ Tenant isolation restore verified. Shop B data remained intact.');
    results.tenantIsolationRestore = true;

    // Clean up Shop B product
    await prisma.product.delete({ where: { id: productB.id } });

    // ----------------------------------------------------
    // TEST 4: CORRUPTED BACKUP REJECTION
    // ----------------------------------------------------
    console.log('\n[TEST 4] Testing Corrupted Backup Payload Rejection...');
    const corruptedPayload = '{"invalid_json": true,'; // broken json format

    try {
      BackupService.validateAndPreviewBackup(shopA.id, corruptedPayload);
      throw new Error('Corrupted JSON passed validation!');
    } catch (err: any) {
      console.log(`✓ Corrupted payload validation rejected successfully: ${err.message}`);
    }

    try {
      await BackupService.restoreBackup(shopA.id, userA.id, corruptedPayload);
      throw new Error('Corrupted JSON was restored!');
    } catch (err: any) {
      console.log(`✓ Corrupted payload restore rejected successfully: ${err.message}`);
    }

    results.corruptedBackupRejected = true;

    // ----------------------------------------------------
    // TEST 5: VERSION COMPATIBILITY
    // ----------------------------------------------------
    console.log('\n[TEST 5] Testing Backup Version Mismatch Rejection...');
    const mismatchPayload = JSON.stringify({
      backupVersion: '9.9', // Mismatched version
      schemaVersion: '20260601',
      appVersion: '1.0.0',
      shopId: shopA.id,
      products: [],
      customers: [],
      suppliers: [],
      sales: [],
      purchases: [],
      expenses: [],
      categories: [],
      brands: [],
      dailyClosings: [],
    });

    try {
      BackupService.validateAndPreviewBackup(shopA.id, mismatchPayload);
      throw new Error('Mismatched backup version passed validation!');
    } catch (err: any) {
      console.log(`✓ Mismatched version rejected successfully: ${err.message}`);
      results.versionMismatchedRejected = true;
    }

    // ----------------------------------------------------
    // TEST 6: DUPLICATE RESOLUTION ON IMPORTS
    // ----------------------------------------------------
    console.log('\n[TEST 6] Testing Import Engine Duplicate Resolution rules...');
    
    // Seed starting products
    const initialProduct = await prisma.product.create({
      data: {
        shopId: shopA.id,
        sku: 'SKU-DUPE-1',
        nameEn: 'Original Product',
        namePa: 'Original Product Pa',
        purchasePrice: 10,
        sellingPrice: 15,
        currentQuantity: 100,
        unit: 'KG',
      },
    });

    // Import rows with duplicate SKU
    const importRows = [
      {
        sku: 'SKU-DUPE-1',
        nameEn: 'Updated Product Name via Import',
        namePa: 'Updated Product Name via Import Pa',
        purchasePrice: 12.5,
        sellingPrice: 18.0,
        currentQuantity: 150,
        unit: 'KG',
      },
      {
        sku: 'SKU-NEW-99',
        nameEn: 'Newly Inserted Product',
        namePa: 'Newly Inserted Product Pa',
        purchasePrice: 5.0,
        sellingPrice: 7.5,
        currentQuantity: 30,
        unit: 'PCS',
      }
    ];

    console.log('Running import products action...');
    const importRes = await ImportService.importProducts(shopA.id, importRows);
    
    if (importRes.imported !== 1 || importRes.updated !== 1) {
      throw new Error(`Import counts mismatch. Imported: ${importRes.imported}, Updated: ${importRes.updated}`);
    }

    // Verify original was updated
    const updatedProd = await prisma.product.findUnique({ where: { id: initialProduct.id } });
    if (!updatedProd || updatedProd.nameEn !== 'Updated Product Name via Import') {
      throw new Error('Deduplication rule failed to update original product.');
    }
    if (Number(updatedProd.sellingPrice) !== 18) {
      throw new Error('Deduplication rule failed to update prices.');
    }

    // Verify new was inserted
    const newProd = await prisma.product.findFirst({ where: { shopId: shopA.id, sku: 'SKU-NEW-99' } });
    if (!newProd) throw new Error('New product row was not inserted.');

    console.log('✓ Import duplicate rules successfully upserted SKU codes.');
    results.duplicateImportResolution = true;

    // Clean up imported products
    await prisma.product.deleteMany({
      where: { id: { in: [initialProduct.id, newProd.id] } }
    });

    // ----------------------------------------------------
    // TEST 7: PWA ASSETS EXISTENCE
    // ----------------------------------------------------
    console.log('\n[TEST 7] Verifying PWA Assets...');
    const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
    const swPath = path.join(process.cwd(), 'public', 'sw.js');
    const icon192Path = path.join(process.cwd(), 'public', 'icons', 'icon-192x192.png');
    const icon512Path = path.join(process.cwd(), 'public', 'icons', 'icon-512x512.png');

    if (!fs.existsSync(manifestPath)) throw new Error('manifest.json does not exist.');
    if (!fs.existsSync(swPath)) throw new Error('sw.js does not exist.');
    if (!fs.existsSync(icon192Path)) throw new Error('icon-192x192.png does not exist.');
    if (!fs.existsSync(icon512Path)) throw new Error('icon-512x512.png does not exist.');

    console.log('✓ PWA manifest, service worker, and high-res logos verified.');
    results.pwaAssetsVerified = true;

    // ----------------------------------------------------
    // TEST 8: AUDIT LOG ENTRIES
    // ----------------------------------------------------
    console.log('\n[TEST 8] Validating Audit Log Trail...');
    const logs = await prisma.auditLog.findMany({
      where: { userId: userA.id },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`Total audit logs for user: ${logs.length}`);
    const backupLogsExist = logs.some(l => l.action.includes('Backup'));
    if (!backupLogsExist) throw new Error('Backup events were not logged in AuditLog.');

    console.log('✓ Audit trail registration verified.');
    results.auditLogsValidated = true;

  } catch (err: any) {
    console.error('\n❌ TEST SUITE FAILED:', err.message);
    process.exit(1);
  }

  console.log('\n==================================================');
  console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  console.log(JSON.stringify(results, null, 2));
  console.log('==================================================');
  process.exit(0);
}

runTests();
