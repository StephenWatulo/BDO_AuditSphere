# ADR 005 - Documents in object storage, metadata in Postgres

Status: Accepted. Date: 2026-09-03.

Files are uploaded directly from the browser to S3-compatible storage with short-lived
presigned URLs issued by the API after permission checks. Postgres stores metadata, versions,
checksums and classification. Downloads are also presigned and written to the audit trail.
MinIO is used locally and in air-gapped deployments.
