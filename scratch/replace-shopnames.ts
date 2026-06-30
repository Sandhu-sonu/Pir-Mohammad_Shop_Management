import * as fs from 'fs';
import * as path from 'path';

const files = [
  'src/app/customers/[id]/page.tsx',
  'src/app/customers/page.tsx',
  'src/app/expenses/page.tsx',
  'src/app/inventory/low-stock/page.tsx',
  'src/app/inventory/page.tsx',
  'src/app/purchases/page.tsx',
  'src/app/sales/page.tsx',
  'src/app/suppliers/page.tsx',
];

for (const relPath of files) {
  const absPath = path.resolve(relPath);
  if (fs.existsSync(absPath)) {
    let content = fs.readFileSync(absPath, 'utf8');
    if (content.includes('shopName="Sher-E-Punjab Retail"')) {
      content = content.replace(/shopName="Sher-E-Punjab Retail"/g, `shopName={user.shopName || 'Punjab Shop'}`);
      fs.writeFileSync(absPath, content, 'utf8');
      console.log(`Updated shopName in: ${relPath}`);
    } else {
      console.log(`No match in: ${relPath}`);
    }
  } else {
    console.log(`File not found: ${relPath}`);
  }
}
