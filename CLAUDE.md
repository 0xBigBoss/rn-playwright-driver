# RN Playwright Driver

Playwright-compatible E2E test driver for React Native applications.

## Project Summary

A standalone package that provides Playwright-like APIs for testing React Native apps on real devices. Uses Chrome DevTools Protocol (CDP) to communicate with the Hermes runtime via Metro's debug endpoint.

## Key Scripts

```bash
bun install          # Install dependencies
bun run build        # Build with tsup
bun run dev          # Watch mode build
bun run lint         # Biome linter
bun run format       # Biome formatter
bun run test         # Vitest tests
bun run typecheck    # TypeScript check
```

## Architecture

```
Test Runner ──WebSocket/CDP──▶ Metro (:8081) ──▶ App (global.__RN_DRIVER__)
```

### Package Structure

```
src/
├── cdp/
│   ├── client.ts        # WebSocket CDP client
│   └── discovery.ts     # Metro target discovery
├── device.ts            # Device interface implementation
├── locator.ts           # Playwright-style locators (Phase 3)
├── pointer.ts           # Touch simulation
├── test.ts              # Playwright fixture export
└── index.ts             # Public API

harness/
└── index.ts             # In-app __RN_DRIVER__ harness

native/
├── ios/                 # iOS native modules (Phase 3)
└── android/             # Android native modules (Phase 3)
```

## Implementation Phases

### Phase 1: Core Driver (MVP)
- CDP client with `Runtime.evaluate` and connection management
- Device/target discovery from Metro `/json`
- `Device` interface implementation
- `device.evaluate()` working
- Basic Playwright test fixture

### Phase 2: Pointer System (MVP)
- `global.__RN_DRIVER__` in-app harness
- `device.pointer.tap/down/move/up/drag`
- Framework adapter pattern

### Phase 3: Locators + Native Modules
- `RNDriverViewTree` native module (iOS/Android)
- `device.getByTestId()`, `device.getByText()`
- `RNDriverScreenshot` native module
- `device.screenshot()`

### Phase 4: Polish
- CDP reconnect/event subscriptions
- Connection retry/reconnect
- Error diagnostics

## Key Constraints

- iOS Simulator cannot render Three.js/WebGL - real devices required
- Hermes CDP required (default in Expo SDK 50+)
- Generic RN UI (Pressable, TextInput) requires Phase 3 native modules
- Framework adapters (R3F, etc.) can register touch handlers in Phase 2

## Design Reference

Full design document at: `../sortessori.prototypes/react-native-three-prototype/docs/NATIVE-E2E-EXPLORATION.md`

## Testing Strategy

- Unit tests: `vitest` for pure logic (CDP client, discovery)
- Integration: Requires real device with Metro running
- E2E: Test the driver against a sample RN app

## Development Notes

- `npx expo run:ios --device "iPhone 16 Pro"` does a full iOS native build, then starts a Metro bundler dev server that does not exit (it's a file watcher). Run E2E tests in a separate terminal while Metro is running.
