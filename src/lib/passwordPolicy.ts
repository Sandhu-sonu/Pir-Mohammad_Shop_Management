interface PasswordPolicy {
  minPasswordLength: number;
  requirePasswordUppercase: boolean;
  requirePasswordNumber: boolean;
  requirePasswordSpecial: boolean;
}

export function validatePassword(password: string, policy: PasswordPolicy): { isValid: boolean; error?: string } {
  const minLength = policy.minPasswordLength ?? 6;

  if (password.length < minLength) {
    return {
      isValid: false,
      error: `ਪਾਸਵਰਡ ਘੱਟੋ-ਘੱਟ ${minLength} ਅੱਖਰਾਂ ਦਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ (Password must be at least ${minLength} characters long)`
    };
  }

  if (policy.requirePasswordUppercase && !/[A-Z]/.test(password)) {
    return {
      isValid: false,
      error: 'ਪਾਸਵਰਡ ਵਿੱਚ ਘੱਟੋ-ਘੱਟ ਇੱਕ ਵੱਡਾ ਅੱਖਰ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ (Password must contain at least one uppercase letter)'
    };
  }

  if (policy.requirePasswordNumber && !/[0-9]/.test(password)) {
    return {
      isValid: false,
      error: 'ਪਾਸਵਰਡ ਵਿੱਚ ਘੱਟੋ-ਘੱਟ ਇੱਕ ਨੰਬਰ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ (Password must contain at least one number)'
    };
  }

  if (policy.requirePasswordSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return {
      isValid: false,
      error: 'ਪਾਸਵਰਡ ਵਿੱਚ ਘੱਟੋ-ਘੱਟ ਇੱਕ ਵਿਸ਼ੇਸ਼ ਚਿੰਨ੍ਹ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ (Password must contain at least one special character)'
    };
  }

  return { isValid: true };
}
