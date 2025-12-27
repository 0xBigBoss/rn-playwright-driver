# RN Playwright Driver - Phase 3 Complete Implementation

## Context

You are continuing implementation of `@0xbigboss/rn-playwright-driver`, a Playwright-compatible E2E test driver for React Native. Phase 1-2 are complete (CDP client, device API, JS pointer system). Phase 3 requires native Expo modules.

**Repository**: `/Users/allen/0xbigboss/rn-playwright-driver`
**Architecture Doc**: `docs/NATIVE-MODULES-ARCHITECTURE.md` (READ THIS FIRST)

## Current State

**Completed (Phase 1-2)**:
- CDP client with WebSocket, Runtime.evaluate, timeout handling
- Target discovery from Metro `/json` endpoint
- Device class with evaluate, waitForFunction, pointer.*
- JS harness (`global.__RN_DRIVER__`) with touch handler registration
- Playwright test fixture with worker-scoped device
- Example Expo app with E2E tests
- All checks pass (tsgo, biome, knip, jscpd)

**Architecture Decisions (confirmed)**:
- Monorepo: `packages/driver`, `packages/view-tree`, `packages/screenshot`, `packages/lifecycle`
- JS harness for touch (no native touch injection)
- Random element handles: `element_{16-char-hex}`
- Fresh view tree queries (no caching)
- Expo Modules API (Swift + Kotlin)

## Task: Complete All Phases

### Phase 3.0: Monorepo Restructure

1. Create `packages/` directory structure
2. Move existing code to `packages/driver/`
3. Configure bun workspaces in root `package.json`
4. Move `example/` to root level
5. Update all imports and paths
6. Verify `bun run check` passes in all packages

### Phase 3.1: View Tree Module (`packages/view-tree/`)

1. Scaffold with `npx create-expo-module@latest rn-driver-view-tree --local` (then restructure)
2. Implement iOS `RNDriverViewTreeModule.swift`:
   - `findByTestId(testId: string) -> NativeResult<ElementInfo>`
   - `findByText(text: string, exact: boolean) -> NativeResult<ElementInfo>`
   - `findByRole(role: string, name?: string) -> NativeResult<ElementInfo>`
   - `findAllByTestId/Text/Role` variants
   - `getBounds(handle: string) -> NativeResult<ElementBounds | null>`
   - `isVisible(handle: string) -> NativeResult<boolean>`
   - Handle management with WeakMap pattern from architecture doc
3. Implement Android `RNDriverViewTreeModule.kt` with same API
4. TypeScript bindings in `src/index.ts`
5. Update harness to bridge native module
6. Update driver's LocatorImpl to use native module
7. Add E2E tests that verify locators work

### Phase 3.2: Screenshot Module (`packages/screenshot/`)

1. Scaffold Expo module
2. Implement iOS:
   - `captureScreen() -> NativeResult<string>` (base64 PNG)
   - `captureElement(handle: string) -> NativeResult<string>`
   - `captureRegion(bounds: ElementBounds) -> NativeResult<string>`
3. Implement Android with same API
4. TypeScript bindings
5. Update harness and driver
6. Add E2E tests for screenshots

### Phase 3.3: Lifecycle Module (`packages/lifecycle/`)

1. Scaffold Expo module
2. Implement iOS:
   - `openURL(url: string) -> NativeResult<void>`
   - `reload() -> NativeResult<void>`
   - `background() -> NativeResult<void>`
   - `foreground() -> NativeResult<void>`
   - `getState() -> NativeResult<'active' | 'background' | 'inactive'>`
3. Implement Android with same API
4. TypeScript bindings
5. Update harness and driver
6. Add E2E tests

### Phase 4: Polish

1. Update all error messages to be actionable
2. Add capability detection to harness
3. Update example app to demonstrate all features
4. Final documentation pass
5. Prepare for npm publish

## Verification Approach

For each module, follow this TDD cycle:

```
1. Write E2E test that exercises the feature
2. Run test (expect failure - native module not implemented)
3. Implement native iOS code
4. Run test on iOS simulator (expect pass)
5. Implement native Android code
6. Run test on Android emulator (expect pass)
7. Run `bun run check` in package
8. Move to next feature
```

After each phase:
```bash
# In monorepo root
bun run check          # All packages
cd example && bun run test:e2e  # E2E tests
```

## Key Files to Read First

1. `docs/NATIVE-MODULES-ARCHITECTURE.md` - Complete architecture
2. `packages/driver/src/types.ts` - Type definitions
3. `packages/driver/src/locator.ts` - Locator stubs to implement
4. `packages/driver/harness/index.ts` - Harness to extend
5. `example/e2e/counter.spec.ts` - Existing E2E tests

## Completion Criteria

The task is complete when ALL of the following are true:

- [ ] Monorepo structure with 4 packages (driver, view-tree, screenshot, lifecycle)
- [ ] `bun run check` passes in all packages
- [ ] `device.getByTestId('x').tap()` works on iOS
- [ ] `device.getByTestId('x').tap()` works on Android
- [ ] `device.getByText('x').isVisible()` works on both platforms
- [ ] `device.screenshot()` returns valid PNG on both platforms
- [ ] `device.openURL()` works on both platforms
- [ ] Example app E2E tests exercise all features
- [ ] No `NativeModuleRequiredError` thrown for implemented features

When all criteria are met, output: <promise>PHASE3_COMPLETE</promise>

## Fallback Guidance

If stuck after 15 iterations:
1. Document what's blocking in `docs/PROGRESS.md`
2. List what was attempted
3. Identify if it's a platform-specific issue (iOS vs Android)
4. Check Expo Modules API docs for patterns
5. Consider if the blocking feature can be deferred

## Command

```bash
/ralph-loop "Complete Phase 3-4 of rn-playwright-driver following the handoff at ~/.claude/handoffs/handoff-rn-playwright-driver-phase3.md. Read the architecture doc first. Implement monorepo restructure, then view-tree, screenshot, and lifecycle Expo modules with iOS and Android native code. Use TDD: write E2E test, implement native, verify, repeat. Run checks after each phase. Output <promise>PHASE3_COMPLETE</promise> when all completion criteria are met." --completion-promise "PHASE3_COMPLETE" --max-iterations 100
```
