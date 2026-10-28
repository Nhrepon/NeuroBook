# Migration Guide — Single App → Monorepo

## Mapping

| Old path | New path |
| --- | --- |
| `src/shared/*` | `packages/shared/src/*` |
| `src/db/*` | `apps/web/src/db/*` |
| `src/app/*` | `apps/web/src/app/*` |
| `src/ui/*` | `apps/web/src/ui/*` |
| `src/proxy.ts` | `apps/web/src/proxy.ts` |
| `mobile/*` | `apps/mobile/*` (update `@neurobook/shared` imports) |

## Steps

1. Create workspace root `package.json` with `workspaces`.
2. Move shared code to `packages/shared`; add `package.json` + `tsconfig`.
3. Update mobile path mappings to `@neurobook/shared`.
4. Move web code to `apps/web`; keep `drizzle.config.ts` there.
5. Add Turborepo pipeline for build/test.
6. Run `npm install` at root; verify `typecheck` and `test`.

## Verification

- `npm run typecheck` passes in all workspaces.
- Contract tests pass against `/api/v1/*`.
- RLS assertion passes in CI.