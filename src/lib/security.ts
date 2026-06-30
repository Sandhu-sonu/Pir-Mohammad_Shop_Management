import bcrypt from 'bcryptjs';

/**
 * Hashes a numeric PIN code using bcrypt.
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pin, salt);
}

/**
 * Compares an inputted PIN code against a hashed PIN stored in the database.
 */
export async function comparePin(pin: string, hashed: string): Promise<boolean> {
  if (!pin || !hashed) return false;
  return bcrypt.compare(pin, hashed);
}

/**
 * Generates a random 4 to 6 digit numeric PIN.
 */
export function generateRandomPin(): string {
  const length = Math.floor(Math.random() * 3) + 4; // 4, 5, or 6
  let pin = '';
  for (let i = 0; i < length; i++) {
    pin += Math.floor(Math.random() * 10).toString();
  }
  return pin;
}
