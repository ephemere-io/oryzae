---
paths:
  - "apps/server/src/**/*.ts"
---

# Server Architecture Rules

## Layer Dependencies (Absolute)

```
presentation → application → domain ← infrastructure
```

- domain imports NOTHING outside itself (except shared/domain)
- application imports domain only (never infrastructure)
- infrastructure imports domain gateways + models only
- presentation imports application + infrastructure (DI wiring only)

## Domain Model Pattern

All domain models MUST follow:
- `private constructor(props: XxxProps)`
- `static create(params, generateId: () => string): Result<T, E>` or `T`
- `static fromProps(props): T` (DB restoration, no validation)
- `withXxx(): Result<T, E>` or `T` (immutable state change)
- `toProps(): XxxProps` (serialization)
- All fields `readonly`

## Error Flow

- domain: Return `Result<T, E>` using `ok()`/`err()` from `shared/domain/types/result.ts`. Never throw.
- application: Check `result.success`, throw `ApplicationError` subclass on failure.
- infrastructure: Throw on external errors.
- presentation: `errorHandler` catches `ApplicationError` and maps `statusCode` to HTTP.

## File Naming

- Usecase: `{verb}-{noun}.usecase.ts`
- Model: `{noun}.ts`
- Service: `{noun}.service.ts`
- Gateway: `{noun}-repository.gateway.ts` (DB) or `{noun}.gateway.ts` (API)
- Infra: `{tech}-{noun}.repository.ts` or `{noun}.client.ts`
- Test: `{name}.test.ts` (co-located)
