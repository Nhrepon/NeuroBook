# ADR-0001 — Monorepo with a framework-free shared package

## Status
Accepted

## Context
NeuroBook ships web, mobile, and desktop clients that must share domain types, Zod schemas, the ledger engine, money helpers, and BD formatters. Duplicating these across apps risks drift in money handling and compliance logic.

## Decision
Use a monorepo (npm/pnpm workspaces) with `apps/*` clients and `packages/shared` as the only cross-boundary. `packages/shared` stays framework-free and importable by every client. Clients never import each other; they communicate through the versioned REST contract.

## Consequences
- Positive: single source of truth for accounting logic; contract tests catch drift.
- Negative: requires discipline in package boundaries and CI enforcement.
- Follow-ups: add `packages/ui-tokens` and `packages/config`.