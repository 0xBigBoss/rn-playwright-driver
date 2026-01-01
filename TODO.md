# TODO - Examples Restructure and E2E Coverage

## Completed
- [x] Previous: Core primitives implementation (iteration 1-N)
- [x] Move example/ to examples/basic-app/
- [x] Update root package.json workspaces to "examples/*"
- [x] Rename example package to examples-basic-app
- [x] Reorganize E2E specs into categorical folders:
  - assertions/ (matchers.spec.ts)
  - core/ (capabilities.spec.ts)
  - integration/ (counter.spec.ts)
  - locators/ (chaining.spec.ts)
  - pointer/ (basic.spec.ts, paths.spec.ts)
  - primitives/ (window-metrics.spec.ts, frame-timing.spec.ts, tracing.spec.ts, touch-backend.spec.ts)
- [x] Add primitives/window-metrics.spec.ts - getWindowMetrics() tests
- [x] Add primitives/frame-timing.spec.ts - getFrameCount(), waitForRaf(), waitForFrameCount() tests
- [x] Add primitives/tracing.spec.ts - startTracing(), stopTracing() tests
- [x] Add primitives/touch-backend.spec.ts - getTouchBackendInfo() tests
- [x] Add pointer/paths.spec.ts - dragPath(), movePath() tests
- [x] Add core/capabilities.spec.ts - capabilities() tests
- [x] Run bun run check - all checks passed

## In Progress
(none)

## Pending
- [ ] Run E2E tests (requires Metro + simulator - not available in current environment)

## Blocked
- [ ] E2E test execution blocked: Metro bundler and iOS simulator not running

## Notes
- Workspace migrated from "example" to "examples/*"
- All new spec files follow the same pattern as existing specs
- Copy-paste detection shows acceptable duplication (~4-5%) which is expected for test files with similar structure
- E2E tests require: `cd examples/basic-app && bun start` (Metro) and a booted iOS simulator
- To run E2E tests manually: `cd examples/basic-app && bun run test:e2e`
