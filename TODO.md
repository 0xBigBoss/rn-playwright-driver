# TODO - E2E Touch Backend Fix

## Completed
- [x] Previous: Core primitives implementation (iteration 1-N)
- [x] Move example/ to examples/basic-app/
- [x] Update root package.json workspaces to "examples/*"
- [x] Rename example package to examples-basic-app
- [x] Reorganize E2E specs into categorical folders
- [x] Add primitives/window-metrics.spec.ts - getWindowMetrics() tests
- [x] Add primitives/frame-timing.spec.ts - getFrameCount(), waitForRaf(), waitForFrameCount() tests
- [x] Add primitives/tracing.spec.ts - startTracing(), stopTracing() tests
- [x] Add primitives/touch-backend.spec.ts - getTouchBackendInfo() tests
- [x] Add pointer/paths.spec.ts - dragPath(), movePath() tests
- [x] Add core/capabilities.spec.ts - capabilities() tests
- [x] Run bun run check - all checks passed
- [x] Configure touch backend via RN_TOUCH_BACKEND env var
- [x] Add parseTouchBackend() to test fixture
- [x] Set RN_TOUCH_BACKEND=harness in examples-basic-app test:e2e script
- [x] Rebuild driver package to include new test fixture code
- [x] Run E2E tests - all 107 tests passed

## In Progress
(none)

## Pending
- [ ] Commit all changes

## Blocked
(none)

## Notes
- RN_TOUCH_BACKEND env var supports:
  - Single value: force mode (e.g., "harness" forces harness backend)
  - Comma-separated: order preference (e.g., "harness,native-module")
- Package rebuild required after modifying packages/driver/src/test.ts
- Copy-paste detection shows acceptable duplication (~5-6%) which is expected for test files
