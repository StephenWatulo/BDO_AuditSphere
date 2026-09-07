# ADR 003 - Declarative workflow state machines

Status: Accepted. Date: 2026-09-03.

Lifecycle rules for engagements, workpapers, findings, plans and requests are declared in
`packages/shared/src/workflows.ts` as transitions with a required permission and named guards.
The API `WorkflowService` is the only code that changes these statuses. The web app reads the
same declarations to render the available actions, so the two never drift.
