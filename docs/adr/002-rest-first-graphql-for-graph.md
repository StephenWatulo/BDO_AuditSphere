# ADR 002 - REST first, GraphQL for graph traversal

Status: Accepted. Date: 2026-09-03.

REST with OpenAPI is the primary contract (simpler caching, tooling, auditability). GraphQL is
exposed only for the knowledge-graph explorer and dashboard composition, where nested
traversal (Risk to Control to Procedure to Evidence to Finding) benefits from client-shaped
queries.
