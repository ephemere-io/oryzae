# Quality Rules

## Before Committing

Run all checks. Fix failures — do not skip with `--no-verify`.

```bash
pnpm typecheck    # TypeScript
pnpm lint         # Biome
pnpm test         # Vitest
pnpm dep-cruise   # DDD layer check
```

## Code Style

- Biome handles formatting (single quotes, semicolons, 2-space indent)
- Do not add comments to obvious code
- Do not add docstrings unless the logic is non-obvious
- 1 usecase = 1 file

## Testing

| Layer | Type | Required |
|-------|------|----------|
| domain/models, domain/services | Unit test | Yes |
| application/usecases | Unit test (mocked gateways) | When complex |
| infrastructure | Integration test | When feasible |
| presentation | E2E | When feasible |

## Prohibited

- `--no-verify` on git commands
- `any` type (use `unknown` + type narrowing)
- `console.log` in production code (use proper error handling)
- Direct push to main
