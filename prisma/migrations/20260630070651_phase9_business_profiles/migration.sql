-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('GENERAL_STORE', 'GROCERY', 'HARDWARE', 'ELECTRICAL', 'PAINT', 'MOBILE', 'COMPUTER', 'STATIONERY', 'BOOK_STORE', 'GARMENTS', 'FOOTWEAR', 'COSMETICS', 'DAIRY', 'BAKERY', 'SWEET_SHOP', 'SPORTS', 'FURNITURE', 'ELECTRONICS', 'AUTO_PARTS', 'PESTICIDE', 'SEED', 'FERTILIZER', 'BUILDING_MATERIAL', 'WHOLESALE', 'MEDICAL');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "gstRate" DECIMAL(5,2),
ADD COLUMN     "hsnCode" TEXT,
ADD COLUMN     "imei" TEXT,
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "manufacturingDate" TIMESTAMP(3),
ADD COLUMN     "modelNumber" TEXT,
ADD COLUMN     "serialNumber" TEXT,
ADD COLUMN     "size" TEXT,
ADD COLUMN     "variant" TEXT,
ADD COLUMN     "warrantyMonths" INTEGER;

-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "businessType" "BusinessType" NOT NULL DEFAULT 'GENERAL_STORE';

-- CreateIndex
CREATE INDEX "sales_customerId_idx" ON "sales"("customerId");

-- CreateIndex
CREATE INDEX "sales_createdByUserId_idx" ON "sales"("createdByUserId");

-- CreateIndex
CREATE INDEX "sales_closedByUserId_idx" ON "sales"("closedByUserId");

-- CreateIndex
CREATE INDEX "sales_reversedByUserId_idx" ON "sales"("reversedByUserId");
