import { BusinessType } from '@prisma/client';

export interface BusinessField {
  name: string;
  visible: boolean;
  required: boolean;
  editable: boolean;
  searchable: boolean;
  exportable: boolean;
  importable: boolean;
  displayOrder: number;
}

export interface BusinessProfile {
  businessType: BusinessType;
  displayName: string;
  defaultUnit: string;
  fields: BusinessField[];
}

// Helper to construct a standard field list
function createFields(overrides: Record<string, Partial<BusinessField>>): BusinessField[] {
  const standardFields: string[] = [
    'sku',
    'barcode',
    'nameEn',
    'namePa',
    'categoryName',
    'brandName',
    'purchasePrice',
    'sellingPrice',
    'currentQuantity',
    'unit',
    'minStock',
    'reorderLevel',
    'taxRate',
    'isActive',
    'supplierId',
  ];

  const optionalFields: string[] = [
    'manufacturer',
    'modelNumber',
    'batchNumber',
    'expiryDate',
    'manufacturingDate',
    'warrantyMonths',
    'serialNumber',
    'imei',
    'color',
    'size',
    'variant',
    'hsnCode',
    'gstRate',
  ];

  const allFields: BusinessField[] = [];
  let order = 1;

  // Add standard fields (always visible and not required in optional override)
  for (const name of standardFields) {
    const override = overrides[name] || {};
    allFields.push({
      name,
      visible: override.visible ?? true,
      required: override.required ?? ['nameEn', 'purchasePrice', 'sellingPrice'].includes(name),
      editable: override.editable ?? true,
      searchable: override.searchable ?? true,
      exportable: override.exportable ?? true,
      importable: override.importable ?? true,
      displayOrder: order++,
    });
  }

  // Add optional fields (default invisible unless overridden)
  for (const name of optionalFields) {
    const override = overrides[name] || {};
    allFields.push({
      name,
      visible: override.visible ?? false,
      required: override.required ?? false,
      editable: override.editable ?? true,
      searchable: override.searchable ?? (override.visible ?? false),
      exportable: override.exportable ?? true,
      importable: override.importable ?? true,
      displayOrder: order++,
    });
  }

  return allFields;
}

const PROFILES: Record<BusinessType, BusinessProfile> = {
  GENERAL_STORE: {
    businessType: 'GENERAL_STORE',
    displayName: 'General Store',
    defaultUnit: 'PCS',
    fields: createFields({}),
  },
  GROCERY: {
    businessType: 'GROCERY',
    displayName: 'Grocery / Kirana Shop',
    defaultUnit: 'KG',
    fields: createFields({}),
  },
  HARDWARE: {
    businessType: 'HARDWARE',
    displayName: 'Hardware Store',
    defaultUnit: 'PCS',
    fields: createFields({
      manufacturer: { visible: true },
      warrantyMonths: { visible: true },
    }),
  },
  ELECTRICAL: {
    businessType: 'ELECTRICAL',
    displayName: 'Electrical Store',
    defaultUnit: 'PCS',
    fields: createFields({
      manufacturer: { visible: true },
      modelNumber: { visible: true },
      warrantyMonths: { visible: true },
    }),
  },
  PAINT: {
    businessType: 'PAINT',
    displayName: 'Paint Store',
    defaultUnit: 'LTR',
    fields: createFields({
      manufacturer: { visible: true },
      color: { visible: true },
      variant: { visible: true },
    }),
  },
  MOBILE: {
    businessType: 'MOBILE',
    displayName: 'Mobile Shop',
    defaultUnit: 'PCS',
    fields: createFields({
      imei: { visible: true, required: true },
      serialNumber: { visible: true },
      modelNumber: { visible: true, required: true },
      warrantyMonths: { visible: true },
      manufacturer: { visible: true },
    }),
  },
  COMPUTER: {
    businessType: 'COMPUTER',
    displayName: 'Computer Shop',
    defaultUnit: 'PCS',
    fields: createFields({
      serialNumber: { visible: true, required: true },
      modelNumber: { visible: true, required: true },
      warrantyMonths: { visible: true },
      manufacturer: { visible: true },
    }),
  },
  STATIONERY: {
    businessType: 'STATIONERY',
    displayName: 'Stationery Shop',
    defaultUnit: 'PCS',
    fields: createFields({}),
  },
  BOOK_STORE: {
    businessType: 'BOOK_STORE',
    displayName: 'Book Store',
    defaultUnit: 'PCS',
    fields: createFields({
      manufacturer: { visible: true }, // represents Publisher
    }),
  },
  GARMENTS: {
    businessType: 'GARMENTS',
    displayName: 'Garment Store',
    defaultUnit: 'PCS',
    fields: createFields({
      size: { visible: true, required: true },
      color: { visible: true },
      variant: { visible: true },
    }),
  },
  FOOTWEAR: {
    businessType: 'FOOTWEAR',
    displayName: 'Footwear Shop',
    defaultUnit: 'PAIR',
    fields: createFields({
      size: { visible: true, required: true },
      color: { visible: true },
      manufacturer: { visible: true },
    }),
  },
  COSMETICS: {
    businessType: 'COSMETICS',
    displayName: 'Cosmetics Shop',
    defaultUnit: 'PCS',
    fields: createFields({
      batchNumber: { visible: true },
      expiryDate: { visible: true },
    }),
  },
  DAIRY: {
    businessType: 'DAIRY',
    displayName: 'Dairy Shop',
    defaultUnit: 'LTR',
    fields: createFields({
      expiryDate: { visible: true, required: true },
    }),
  },
  BAKERY: {
    businessType: 'BAKERY',
    displayName: 'Bakery',
    defaultUnit: 'PCS',
    fields: createFields({
      expiryDate: { visible: true, required: true },
    }),
  },
  SWEET_SHOP: {
    businessType: 'SWEET_SHOP',
    displayName: 'Sweet Shop',
    defaultUnit: 'KG',
    fields: createFields({}),
  },
  SPORTS: {
    businessType: 'SPORTS',
    displayName: 'Sports Shop',
    defaultUnit: 'PCS',
    fields: createFields({
      manufacturer: { visible: true },
      size: { visible: true },
      color: { visible: true },
    }),
  },
  FURNITURE: {
    businessType: 'FURNITURE',
    displayName: 'Furniture Store',
    defaultUnit: 'PCS',
    fields: createFields({
      manufacturer: { visible: true },
      color: { visible: true },
    }),
  },
  ELECTRONICS: {
    businessType: 'ELECTRONICS',
    displayName: 'Electronics Store',
    defaultUnit: 'PCS',
    fields: createFields({
      serialNumber: { visible: true, required: true },
      modelNumber: { visible: true, required: true },
      warrantyMonths: { visible: true, required: true },
      manufacturer: { visible: true },
    }),
  },
  AUTO_PARTS: {
    businessType: 'AUTO_PARTS',
    displayName: 'Auto Parts Shop',
    defaultUnit: 'PCS',
    fields: createFields({
      manufacturer: { visible: true },
      modelNumber: { visible: true },
      hsnCode: { visible: true },
    }),
  },
  PESTICIDE: {
    businessType: 'PESTICIDE',
    displayName: 'Pesticide Store',
    defaultUnit: 'LTR',
    fields: createFields({
      manufacturer: { visible: true, required: true },
      batchNumber: { visible: true, required: true },
      expiryDate: { visible: true, required: true },
      manufacturingDate: { visible: true },
      hsnCode: { visible: true },
      gstRate: { visible: true },
    }),
  },
  SEED: {
    businessType: 'SEED',
    displayName: 'Seed Store',
    defaultUnit: 'KG',
    fields: createFields({
      manufacturer: { visible: true, required: true },
      batchNumber: { visible: true, required: true },
      expiryDate: { visible: true, required: true },
    }),
  },
  FERTILIZER: {
    businessType: 'FERTILIZER',
    displayName: 'Fertilizer Store',
    defaultUnit: 'BAG',
    fields: createFields({
      manufacturer: { visible: true, required: true },
      batchNumber: { visible: true, required: true },
      expiryDate: { visible: true, required: true },
      hsnCode: { visible: true },
    }),
  },
  BUILDING_MATERIAL: {
    businessType: 'BUILDING_MATERIAL',
    displayName: 'Building Material Store',
    defaultUnit: 'PCS',
    fields: createFields({}),
  },
  WHOLESALE: {
    businessType: 'WHOLESALE',
    displayName: 'Wholesale Distributor',
    defaultUnit: 'BOX',
    fields: createFields({
      hsnCode: { visible: true },
      gstRate: { visible: true },
    }),
  },
  MEDICAL: {
    businessType: 'MEDICAL',
    displayName: 'Medical Store',
    defaultUnit: 'BOX',
    fields: createFields({
      batchNumber: { visible: true, required: true },
      expiryDate: { visible: true, required: true },
      manufacturer: { visible: true, required: true },
      hsnCode: { visible: true },
    }),
  },
};

export function getBusinessProfile(businessType: BusinessType): BusinessProfile {
  return PROFILES[businessType] || PROFILES.GENERAL_STORE;
}
