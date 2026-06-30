export class AppError extends Error {
  constructor(public message: string, public code: string, public statusCode = 400) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Not authenticated') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Permission denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(message, 'BUSINESS_RULE_ERROR', 400);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR', 500);
  }
}

export function handleActionError(err: any) {
  console.error('App action error caught:', err);
  if (err instanceof AppError) {
    return { success: false, error: err.message, code: err.code };
  }

  // Handle Prisma unique constraint errors (P2002)
  if (err?.code === 'P2002') {
    const targets = err.meta?.target || [];
    let message = 'ਇੱਕ ਰਿਕਾਰਡ ਪਹਿਲਾਂ ਹੀ ਮੌਜੂਦ ਹੈ (A record with this unique value already exists).';
    if (targets.includes('mobile')) {
      message = 'ਗਾਹਕ/ਸਪਲਾਇਰ ਦਾ ਇਹ ਮੋਬਾਈਲ ਨੰਬਰ ਪਹਿਲਾਂ ਹੀ ਰਜਿਸਟਰਡ ਹੈ (This mobile number is already registered).';
    } else if (targets.includes('barcode')) {
      message = 'ਇਹ ਬਾਰਕੋਡ ਪਹਿਲਾਂ ਹੀ ਕਿਸੇ ਹੋਰ ਉਤਪਾਦ ਲਈ ਵਰਤਿਆ ਗਿਆ ਹੈ (This barcode is already in use by another product).';
    } else if (targets.includes('sku')) {
      message = 'ਇਹ SKU ਪਹਿਲਾਂ ਹੀ ਕਿਸੇ ਹੋਰ ਉਤਪਾਦ ਲਈ ਵਰਤਿਆ ਗਿਆ ਹੈ (This SKU is already in use).';
    } else if (targets.includes('invoiceNumber')) {
      message = 'ਇਹ ਇਨਵੌਇਸ ਨੰਬਰ ਪਹਿਲਾਂ ਹੀ ਮੌਜੂਦ ਹੈ (This invoice number already exists).';
    }
    return { success: false, error: message, code: 'UNIQUE_CONSTRAINT_ERROR' };
  }

  // Handle Prisma foreign key constraint errors (P2003)
  if (err?.code === 'P2003') {
    return {
      success: false,
      error: 'ਰਿਕਾਰਡ ਸਬੰਧਿਤ ਟ੍ਰਾਂਜੈਕਸ਼ਨ ਹੋਣ ਕਰਕੇ ਮਿਟਾਇਆ ਜਾਂ ਬਦਲਿਆ ਨਹੀਂ ਜਾ ਸਕਦਾ (Cannot delete or modify this record because it is referenced by other transactions).',
      code: 'FOREIGN_KEY_VIOLATION'
    };
  }

  return { success: false, error: 'An unexpected database/system error occurred.', code: 'INTERNAL_ERROR' };
}
