import { decrypt, encrypt, randomPassword, randomRecoveryCode, sha256 } from './crypto';
import { pageArgs, parseSort } from './pagination';
import { toSerializable } from './serialize.interceptor';
import { redact } from './utils';
import { buildAuthUser } from '../auth/user-access.service';
import { parseDuration } from '../config/duration';
import { deriveKey } from '../config/app-config.service';

describe('crypto', () => {
  const key = deriveKey('a'.repeat(64));

  it('round-trips AES-256-GCM and rejects tampering', () => {
    const enc = encrypt('JBSWY3DPEHPK3PXP', key);
    expect(enc.startsWith('v1:')).toBe(true);
    expect(decrypt(enc, key)).toBe('JBSWY3DPEHPK3PXP');
    const tampered = `v1:${Buffer.from(enc.slice(3), 'base64').fill(0, 30, 31).toString('base64')}`;
    expect(() => decrypt(tampered, key)).toThrow();
    expect(() => decrypt(enc, deriveKey('b'.repeat(64)))).toThrow();
  });

  it('derives a 32-byte key from hex or from a passphrase', () => {
    expect(deriveKey('ab'.repeat(32)).toString('hex')).toBe('ab'.repeat(32));
    expect(deriveKey('change-me-passphrase-that-is-not-hex').length).toBe(32);
  });

  it('produces well-formed recovery codes and temporary passwords', () => {
    expect(randomRecoveryCode()).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const pw = randomPassword();
    expect(pw).toHaveLength(14);
    expect(pw).toMatch(/[A-Z]/);
    expect(pw).toMatch(/[a-z]/);
    expect(pw).toMatch(/\d/);
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('pagination', () => {
  it('clamps page and pageSize', () => {
    expect(pageArgs({})).toEqual({ skip: 0, take: 25, page: 1, pageSize: 25 });
    expect(pageArgs({ page: 3, pageSize: 500 })).toEqual({ skip: 400, take: 200, page: 3, pageSize: 200 });
  });

  it('only sorts by allow-listed fields', () => {
    expect(parseSort('title:desc', ['title', 'createdAt'] as const, { createdAt: 'desc' })).toEqual({ title: 'desc' });
    expect(parseSort('passwordHash:asc', ['title'] as const, { title: 'asc' })).toEqual({ title: 'asc' });
    expect(parseSort(undefined, ['title'] as const, { title: 'asc' })).toEqual({ title: 'asc' });
  });
});

describe('serialisation and redaction', () => {
  it('converts BigInt and Decimal-like values recursively', () => {
    const decimal = { toNumber: () => 12.5, constructor: { name: 'Decimal' } };
    Object.setPrototypeOf(decimal, { constructor: { name: 'Decimal' } });
    const out = toSerializable({ id: 10n, nested: [{ size: 5n }], when: new Date('2026-01-01T00:00:00Z'), amount: decimal }) as any;
    expect(out.id).toBe(10);
    expect(out.nested[0].size).toBe(5);
    expect(out.when).toBeInstanceOf(Date);
    expect(out.amount).toBe(12.5);
  });

  it('redacts secrets before they reach the audit trail', () => {
    const out = redact({ email: 'a@b.c', passwordHash: 'x', nested: { mfaSecretEnc: 'y', ok: 1 } });
    expect(out).toEqual({ email: 'a@b.c', passwordHash: '[redacted]', nested: { mfaSecretEnc: '[redacted]', ok: 1 } });
  });
});

describe('buildAuthUser', () => {
  const base = {
    id: 'u', tenantId: 't', email: 'x@y.z', displayName: 'X', firstName: null, lastName: null, jobTitle: null, avatarUrl: null,
    status: 'ACTIVE', authProvider: 'LOCAL', mfaEnabled: false, tenant: { id: 't', slug: 's', name: 'N', isActive: true },
  };

  it('unions static role permissions with DB role permissions and flags MFA enrolment', () => {
    const user = buildAuthUser({
      ...base,
      roles: [{ role: { key: 'JUNIOR_AUDITOR', permissions: [{ permission: { key: 'custom:extra' } }] } }],
    } as any);
    expect(user.roles).toEqual(['JUNIOR_AUDITOR']);
    expect(user.permissions).toContain('workpaper:prepare');
    expect(user.permissions).toContain('custom:extra');
    expect(user.permissions).not.toContain('user:manage');
    expect(user.mfaRequiredToEnrol).toBe(true);
  });

  it('does not nag business owners or Entra users about MFA', () => {
    const bo = buildAuthUser({ ...base, roles: [{ role: { key: 'BUSINESS_OWNER', permissions: [] } }] } as any);
    expect(bo.mfaRequiredToEnrol).toBe(false);
    const entra = buildAuthUser({ ...base, authProvider: 'ENTRA_ID', roles: [{ role: { key: 'AUDIT_MANAGER', permissions: [] } }] } as any);
    expect(entra.mfaRequiredToEnrol).toBe(false);
  });
});

describe('parseDuration', () => {
  it('parses common TTL formats', () => {
    expect(parseDuration('15m')).toBe(900_000);
    expect(parseDuration('30d')).toBe(2_592_000_000);
    expect(parseDuration('900')).toBe(900_000);
    expect(() => parseDuration('soon')).toThrow();
  });
});
