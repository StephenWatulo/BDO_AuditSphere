/** One-time production-safe tenant and Global Administrator bootstrap. */
import fs from 'node:fs';
import path from 'node:path';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, permissionModule } from '@auditsphere/shared';

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  for (const file of [path.join(__dirname, '..', '.env'), path.join(__dirname, '..', '..', '..', '.env')]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (!match) continue;
      const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
      if (!(match[1] in process.env)) process.env[match[1]] = value;
    }
    if (process.env.DATABASE_URL) return;
  }
}

loadEnv();
const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const tenantSlug = required('BOOTSTRAP_TENANT_SLUG').toLowerCase();
const tenantName = required('BOOTSTRAP_TENANT_NAME');
const email = required('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
const password = required('BOOTSTRAP_ADMIN_PASSWORD');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantSlug)) throw new Error('BOOTSTRAP_TENANT_SLUG must be a lowercase URL slug');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('BOOTSTRAP_ADMIN_EMAIL must be a valid email address');
if (password.length < 14 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
  throw new Error('BOOTSTRAP_ADMIN_PASSWORD must have at least 14 characters and include upper, lower, number, and symbol');
}

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { name: tenantName, isActive: true },
    create: { slug: tenantSlug, name: tenantName, settings: { currency: process.env.BOOTSTRAP_CURRENCY ?? 'KES' } },
  });
  const existingAdmin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, roles: { some: { role: { key: 'GLOBAL_ADMIN' } } }, deletedAt: null },
    select: { email: true },
  });
  if (existingAdmin) throw new Error(`A Global Administrator already exists for ${tenantSlug} (${existingAdmin.email}); bootstrap is one-time only`);

  const permissions = new Map<string, string>();
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: { description, module: permissionModule(key as keyof typeof PERMISSIONS) },
      create: { key, description, module: permissionModule(key as keyof typeof PERMISSIONS) },
    });
    permissions.set(key, permission.id);
  }
  const role = await prisma.role.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'GLOBAL_ADMIN' } },
    update: { name: ROLE_LABELS.GLOBAL_ADMIN, isSystem: true },
    create: { tenantId: tenant.id, key: 'GLOBAL_ADMIN', name: ROLE_LABELS.GLOBAL_ADMIN, description: 'Global Administrator (system role)', isSystem: true },
  });
  await prisma.rolePermission.createMany({
    data: ROLE_PERMISSIONS.GLOBAL_ADMIN.map((key) => ({ roleId: role.id, permissionId: permissions.get(key)! })),
    skipDuplicates: true,
  });
  const displayName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || email.split('@')[0];
  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email,
      displayName,
      status: 'ACTIVE',
      authProvider: 'LOCAL',
      passwordHash: await hash(password),
      preferences: { mustChangePassword: true, timezone: process.env.BOOTSTRAP_TIMEZONE ?? 'Africa/Nairobi' },
      roles: { create: { tenantId: tenant.id, roleId: role.id } },
    },
  });
  console.log(`Created tenant ${tenant.slug} and one Global Administrator (${admin.email}). The first session must replace the bootstrap password; then enrol MFA.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
