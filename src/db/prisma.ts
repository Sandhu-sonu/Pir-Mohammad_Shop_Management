import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaInstance: PrismaClient;

if (typeof window === 'undefined') {
  // Validate critical env variables
  if (!process.env.DATABASE_URL) {
    console.error('[CRITICAL STARTUP ERROR] DATABASE_URL is not set.');
    process.exit(1);
  }

  // Validate and ensure writable storage directories
  const requiredDirs = [
    path.join(process.cwd(), 'storage'),
    path.join(process.cwd(), 'storage', 'backups'),
    path.join(process.cwd(), 'storage', 'exports'),
  ];

  for (const dir of requiredDirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Use process-unique randomized filename to avoid concurrent worker race conditions
      const testFile = path.join(dir, `.write_test_${process.pid}_${Math.random().toString(36).substring(2)}`);
      fs.writeFileSync(testFile, 'test');
      try {
        fs.unlinkSync(testFile);
      } catch {
        // Ignore unlink failure
      }
    } catch (err: any) {
      console.error(`[CRITICAL STARTUP ERROR] Directory "${dir}" is not writable:`, err.message);
      process.exit(1);
    }
  }

  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  prismaInstance =
    globalForPrisma.prisma ??
    new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaInstance;
  }
} else {
  // Empty client fallback for client bundlers to satisfy compilation
  prismaInstance = null as unknown as PrismaClient;
}

export const prisma = prismaInstance;
