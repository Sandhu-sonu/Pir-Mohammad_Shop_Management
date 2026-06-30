-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "currencySymbol" TEXT NOT NULL DEFAULT '₹',
ADD COLUMN     "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
ADD COLUMN     "decimalPrecision" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "invoicePrefix" TEXT NOT NULL DEFAULT 'INV-',
ADD COLUMN     "printerWidth" TEXT NOT NULL DEFAULT '80mm';

-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "email" TEXT,
ADD COLUMN     "footerMessage" TEXT,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "returnPolicy" TEXT;
