# Release Notes - v0.1.86

## Pi Runtime Boundary Smoke Hardening

This Beta patch tightens the Ant Colony ↔ Pi SDK boundary before the next integration slice.

## Highlights

- Added host-shaped `runSyncColony` integration smoke coverage.
- Covered provider/model registry resolution through the Pi adapter path.
- Covered SDK-backed session lifecycle forwarding: `prompt`, `abort`, `dispose`, and message fallback.
- Covered cancellation propagation from `AbortSignal` into runtime session `abort()` / `dispose()`.
- Marked M2 Pi SDK compatibility smoke coverage complete in `ROADMAP.md`.

## Validation

```bash
npm run build -- --pretty false
npm test -- --run
```

Result:

- 23/23 test files passed
- 245/245 tests passed

## Still Beta

This release is still **Beta / Preview**. A true external Pi host fixture smoke remains future opt-in work and is intentionally not part of default CI.
