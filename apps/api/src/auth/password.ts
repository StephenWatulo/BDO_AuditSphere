import { hash, verify } from '@node-rs/argon2';

/** Argon2id with OWASP-recommended parameters (19 MiB, t=2, p=1). */
const ARGON2ID = 2;
const OPTIONS = { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(hashed: string | null | undefined, password: string): Promise<boolean> {
  if (!hashed) return false;
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}

export const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 128,
  /** At least one letter and one digit. */
  pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/,
  message: 'Password must be at least 8 characters and contain a letter and a digit',
};
