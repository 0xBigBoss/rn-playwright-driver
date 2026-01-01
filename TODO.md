# TODO - Core Primitives Implementation

## Completed
- [x] Add harness support for window metrics (getWindowMetrics) (iteration 1)
- [x] Add harness support for RAF frame counter (iteration 1)
- [x] Add harness trace buffer + event schema (iteration 1)
- [x] Add types: WindowMetrics, TouchBackendInfo, DriverEvent, TracingOptions (iteration 1)
- [x] Implement device APIs: getWindowMetrics, getFrameCount, waitForRaf, waitForFrameCount (iteration 1)
- [x] Implement device.getTouchBackendInfo() (iteration 1)
- [x] Implement device.startTracing/stopTracing (iteration 1)
- [x] Implement pointer.dragPath and pointer.movePath (iteration 1)
- [x] Standardize locator error messages for missing view-tree (iteration 1)
- [x] Export new types from index.ts (iteration 1)
- [x] Run bun run check and fix issues (iteration 1)
- [x] Update README/ADVANCED.md with new API examples (iteration 1)

## In Progress
(none)

## Pending
(none)

## Blocked
(none)

## Notes
- All core primitives from docs/CORE-PRIMITIVES-PROPOSAL.md have been implemented
- Harness now exposes: getWindowMetrics(), getFrameCount(), startTracing(), stopTracing(), isTracing()
- Device now exposes: getWindowMetrics(), getFrameCount(), waitForRaf(), waitForFrameCount(), getTouchBackendInfo(), startTracing(), stopTracing()
- Pointer now exposes: dragPath(), movePath()
- TouchBackendSelection now includes selection info (backend type, available backends, reason)
- Error messages for missing native modules now include installation instructions
- Documentation updated in README.md and docs/ADVANCED.md
