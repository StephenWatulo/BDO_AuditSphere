# ADR 001 - Multi-tenancy via tenant column and PostgreSQL RLS

Status: Accepted. Date: 2026-09-03.

## Context
BDO member firms and their clients need isolated data in one deployment. Options: database per
tenant, schema per tenant, or shared tables with a tenant discriminator.

## Decision
Shared tables with `tenantId` on every business table. Isolation is enforced twice: a Prisma
client extension injects `tenantId` on every query and write, and PostgreSQL Row Level Security
policies check `current_setting('app.tenant_id')`, which the API sets per transaction.

## Consequences
Single migration path and simple operations. Cross-tenant analytics for BDO global remain
possible through a service role. Every query must run through the tenant-scoped client; the
raw client is restricted to auth and provisioning code.
