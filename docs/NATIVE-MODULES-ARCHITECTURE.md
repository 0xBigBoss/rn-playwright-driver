# Native Modules Architecture

## Overview

This document describes the complete architecture for Phase 3 native modules in `@0xbigboss/rn-playwright-driver`. The design prioritizes:

1. **Consistency** - Uniform API patterns across iOS and Android
2. **Cohesion** - Modules work together through shared types and conventions
3. **Separation** - Driver remains remote; native code lives in the tested app
4. **Expo-first** - Built on Expo Modules API for modern RN compatibility

## Quick Reference

| Decision | Choice |
|----------|--------|
| Repository structure | Monorepo (`packages/driver`, `packages/view-tree`, etc.) |
| Touch injection | Tiered backends: companion (OS-level) → native module → CLI → harness |
| Element handles | Random IDs (`element_{16-char-hex}`) |
| View tree queries | Fresh traversal (no caching) |
| Native module API | Expo Modules API (Swift + Kotlin) |
| Coordinates | Logical points (not pixels) |
| Result type | `NativeResult<T>` with error codes |

### Packages

| Package | Purpose | Status |
|---------|---------|--------|
| `@0xbigboss/rn-playwright-driver` | Test driver (no native code) | ✅ Complete |
| `@0xbigboss/rn-driver-view-tree` | Element queries, bounds, visibility | ✅ Complete |
| `@0xbigboss/rn-driver-screenshot` | Screen/element capture | ✅ Complete |
| `@0xbigboss/rn-driver-lifecycle` | App state control | 🔶 Partial |
| `@0xbigboss/rn-playwright-driver-xctest-companion` | iOS OS-level touch injection | ✅ Reference impl (manual integration) |
| `@0xbigboss/rn-playwright-driver-instrumentation-companion` | Android OS-level touch injection | ✅ Reference impl (manual integration) |
| `@0xbigboss/rn-driver-touch-injector` | In-app touch synthesis | ❌ Not started |

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TEST PROCESS                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Playwright Test Runner                                              │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │  @0xbigboss/rn-playwright-driver                            │    │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │    │   │
│  │  │  │  Device  │  │ Locator  │  │ Pointer  │  │ Assert   │    │    │   │
│  │  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │    │   │
│  │  │       │              │              │              │         │    │   │
│  │  │       └──────────────┴──────────────┴──────────────┘         │    │   │
│  │  │                           │                                   │    │   │
│  │  │                    ┌──────┴──────┐                           │    │   │
│  │  │                    │  CDP Client │                           │    │   │
│  │  │                    └──────┬──────┘                           │    │   │
│  │  └───────────────────────────┼──────────────────────────────────┘    │   │
│  └──────────────────────────────┼───────────────────────────────────────┘   │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │ WebSocket (CDP)
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              APP PROCESS                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Metro Bundler (:8081)                                               │   │
│  │                    │                                                 │   │
│  │                    ▼                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │  Hermes Runtime                                              │    │   │
│  │  │  ┌─────────────────────────────────────────────────────┐    │    │   │
│  │  │  │  global.__RN_DRIVER__ (Harness)                     │    │    │   │
│  │  │  │  ├── version: string                                │    │    │   │
│  │  │  │  ├── pointer: { tap, down, move, up }              │    │    │   │
│  │  │  │  ├── viewTree: ViewTreeBridge      ◄── Phase 3     │    │    │   │
│  │  │  │  ├── screenshot: ScreenshotBridge  ◄── Phase 3     │    │    │   │
│  │  │  │  └── lifecycle: LifecycleBridge    ◄── Phase 3     │    │    │   │
│  │  │  └─────────────────────┬───────────────────────────────┘    │    │   │
│  │  └────────────────────────┼────────────────────────────────────┘    │   │
│  └───────────────────────────┼──────────────────────────────────────────┘   │
│                              │ Expo Modules Bridge                          │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Native Modules (Expo Modules API)                                   │   │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐        │   │
│  │  │ RNDriverViewTree│ │RNDriverScreenshot│ │RNDriverLifecycle│        │   │
│  │  │  (Swift/Kotlin) │ │  (Swift/Kotlin)  │ │  (Swift/Kotlin) │        │   │
│  │  └────────┬────────┘ └────────┬─────────┘ └────────┬────────┘        │   │
│  │           │                   │                    │                 │   │
│  │           ▼                   ▼                    ▼                 │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │  Platform APIs                                               │    │   │
│  │  │  iOS: UIView, UIAccessibility, UIGraphicsImageRenderer       │    │   │
│  │  │  Android: View, AccessibilityNodeInfo, Bitmap                │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Architectural Decisions

### 1. Driver Remains Remote

The driver package (`@0xbigboss/rn-playwright-driver`) contains **no native code**. It communicates with the app via CDP only. This means:

- Driver can run in any Node.js environment
- No native build required for the test runner
- Native modules are installed in the **tested app**, not the driver

### 2. Harness as Bridge

The `global.__RN_DRIVER__` harness (already exists for Phase 2) is extended to expose native module functionality. The driver calls these via `device.evaluate()`:

```typescript
// Driver side (test process)
const bounds = await device.evaluate<ElementBounds>(
  `global.__RN_DRIVER__.viewTree.getBounds('my-button')`
);

// This calls into the native module inside the app
```

### 3. Handle-Based Element References

Elements are referenced by handles (strings), not direct object references. This allows:

- Serialization across CDP boundary
- Stable references that survive JS garbage collection
- Platform-agnostic element identification

```typescript
type ElementHandle = string; // e.g., "element_a1b2c3d4"
```

### 4. Logical Points Everywhere

All coordinates use **logical points** (not physical pixels). This matches:
- React Native's coordinate system
- Playwright's default behavior
- Cross-device consistency

---

## Shared Type Definitions

These types are shared across the driver, harness, and native modules:

```typescript
// ══════════════════════════════════════════════════════════════════════════
// ELEMENT TYPES
// ══════════════════════════════════════════════════════════════════════════

/**
 * Bounding rectangle in logical points.
 * Origin (0,0) is top-left of screen.
 */
type ElementBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Element information returned from view tree queries.
 */
type ElementInfo = {
  /** Stable handle for referencing this element */
  handle: ElementHandle;

  /** testID prop (iOS: accessibilityIdentifier) */
  testId: string | null;

  /** Visible text content */
  text: string | null;

  /** Accessibility role */
  role: string | null;

  /** Accessibility label */
  label: string | null;

  /** Bounding rectangle in logical points */
  bounds: ElementBounds;

  /** Whether element is currently visible on screen */
  visible: boolean;

  /** Whether element is enabled for interaction */
  enabled: boolean;
};

/**
 * Unique identifier for an element instance.
 * Format: "element_{16-char-hex}" (e.g., "element_a1b2c3d4e5f67890")
 *
 * Generated by native module when element is found.
 * Valid only for the lifetime of the native view.
 */
type ElementHandle = `element_${string}`;

/**
 * Handle generation (native side):
 *
 * iOS (Swift):
 *   let handle = "element_\(UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(16))"
 *
 * Android (Kotlin):
 *   val handle = "element_${UUID.randomUUID().toString().replace("-", "").take(16)}"
 */

// ══════════════════════════════════════════════════════════════════════════
// QUERY TYPES
// ══════════════════════════════════════════════════════════════════════════

/**
 * Options for text-based queries.
 */
type TextQueryOptions = {
  /** Require exact match (default: false = substring match) */
  exact?: boolean;
};

/**
 * Options for role-based queries.
 */
type RoleQueryOptions = {
  /** Filter by accessible name */
  name?: string;
};

// ══════════════════════════════════════════════════════════════════════════
// RESULT TYPES
// ══════════════════════════════════════════════════════════════════════════

/**
 * Standard result wrapper for native module calls.
 * Enables consistent error handling across platforms.
 */
type NativeResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: ErrorCode };

type ErrorCode =
  | 'NOT_FOUND'        // Element not found
  | 'MULTIPLE_FOUND'   // Multiple elements match (when expecting one)
  | 'NOT_VISIBLE'      // Element exists but not visible
  | 'NOT_ENABLED'      // Element visible but not enabled
  | 'TIMEOUT'          // Operation timed out
  | 'INTERNAL'         // Internal error
  | 'NOT_SUPPORTED';   // Feature not available on this platform
```

---

## Native Module Specifications

### Module 1: RNDriverViewTree

**Purpose**: Query and inspect the native view hierarchy.

**Package**: `expo-rn-driver-view-tree`

#### API

```typescript
interface ViewTreeModule {
  // ── Single Element Queries ──────────────────────────────────────────────

  /**
   * Find element by testID prop.
   * iOS: matches accessibilityIdentifier
   * Android: matches view tag set by testID
   */
  findByTestId(testId: string): Promise<NativeResult<ElementInfo>>;

  /**
   * Find element by text content.
   * Searches: Text component children, accessibilityLabel
   */
  findByText(text: string, options?: TextQueryOptions): Promise<NativeResult<ElementInfo>>;

  /**
   * Find element by accessibility role.
   * Maps to accessibilityRole prop.
   */
  findByRole(role: string, options?: RoleQueryOptions): Promise<NativeResult<ElementInfo>>;

  // ── Multiple Element Queries ────────────────────────────────────────────

  findAllByTestId(testId: string): Promise<NativeResult<ElementInfo[]>>;
  findAllByText(text: string, options?: TextQueryOptions): Promise<NativeResult<ElementInfo[]>>;
  findAllByRole(role: string, options?: RoleQueryOptions): Promise<NativeResult<ElementInfo[]>>;

  // ── Element State ───────────────────────────────────────────────────────

  /**
   * Get current bounds of element by handle.
   * Returns null if element no longer exists.
   */
  getBounds(handle: ElementHandle): Promise<NativeResult<ElementBounds | null>>;

  /**
   * Check if element is visible on screen.
   */
  isVisible(handle: ElementHandle): Promise<NativeResult<boolean>>;

  /**
   * Check if element is enabled for interaction.
   */
  isEnabled(handle: ElementHandle): Promise<NativeResult<boolean>>;

  /**
   * Refresh element info (re-query by handle).
   */
  refresh(handle: ElementHandle): Promise<NativeResult<ElementInfo | null>>;
}
```

#### Platform Implementation Notes

**iOS (Swift)**:
```swift
// Traverse UIView hierarchy from key window
// Match testID via accessibilityIdentifier
// Match text via accessibilityLabel or subview text content
// Match role via accessibilityTraits mapping
// Calculate bounds using convertRect:toView:nil for screen coordinates
// Divide by screen scale for logical points
```

**Android (Kotlin)**:
```kotlin
// Traverse View hierarchy from decorView
// Match testID via view.getTag(R.id.accessibility_test_id) or contentDescription
// Match text via TextView.getText() or contentDescription
// Match role via AccessibilityNodeInfo.getClassName() mapping
// Calculate bounds using getLocationOnScreen() and view dimensions
// Already in logical points (dp)
```

---

### Module 2: RNDriverScreenshot

**Purpose**: Capture screen and element screenshots.

**Package**: `expo-rn-driver-screenshot`

#### API

```typescript
interface ScreenshotModule {
  /**
   * Capture full screen screenshot.
   * Returns base64-encoded PNG.
   */
  captureScreen(): Promise<NativeResult<string>>;

  /**
   * Capture screenshot of specific element.
   * Returns base64-encoded PNG cropped to element bounds.
   */
  captureElement(handle: ElementHandle): Promise<NativeResult<string>>;

  /**
   * Capture screenshot of specific region.
   * Bounds are in logical points.
   */
  captureRegion(bounds: ElementBounds): Promise<NativeResult<string>>;
}
```

#### Platform Implementation Notes

**iOS (Swift)**:
```swift
// Use UIGraphicsImageRenderer for screen capture
// Use drawHierarchy(in:afterScreenUpdates:) for view capture
// Scale by UIScreen.main.scale for retina
// Encode as PNG using pngData()
// Return base64 string
```

**Android (Kotlin)**:
```kotlin
// Create Bitmap with view dimensions
// Draw view hierarchy to Canvas
// Use PixelCopy for hardware-accelerated views (API 26+)
// Fallback to view.draw(canvas) for older APIs
// Compress as PNG to ByteArrayOutputStream
// Return base64 string
```

---

### Module 3: RNDriverLifecycle

**Purpose**: Control app lifecycle and navigation.

**Package**: `expo-rn-driver-lifecycle`

#### API

```typescript
interface LifecycleModule {
  /**
   * Open a URL in the app.
   * Handles deep links and universal links.
   */
  openURL(url: string): Promise<NativeResult<void>>;

  /**
   * Reload the JavaScript bundle.
   */
  reload(): Promise<NativeResult<void>>;

  /**
   * Move app to background.
   */
  background(): Promise<NativeResult<void>>;

  /**
   * Bring app to foreground.
   */
  foreground(): Promise<NativeResult<void>>;

  /**
   * Get current app state.
   */
  getState(): Promise<NativeResult<'active' | 'background' | 'inactive'>>;
}
```

#### Platform Implementation Notes

**iOS (Swift)**:
```swift
// openURL: UIApplication.shared.open(url)
// reload: RCTBridge.reload() or DevSettings.reload()
// background: Simulate home button via private API or XCUITest
// foreground: Re-activate via URL scheme
// getState: UIApplication.shared.applicationState
```

**Android (Kotlin)**:
```kotlin
// openURL: startActivity with Intent.ACTION_VIEW
// reload: ReactInstanceManager.recreateReactContextInBackground()
// background: moveTaskToBack(true)
// foreground: startActivity with FLAG_ACTIVITY_REORDER_TO_FRONT
// getState: ProcessLifecycleOwner.get().lifecycle.currentState
```

---

## Harness Integration

The harness (`global.__RN_DRIVER__`) is extended to bridge native modules:

```typescript
// harness/index.ts (Phase 3 additions)

import ViewTreeModule from 'expo-rn-driver-view-tree';
import ScreenshotModule from 'expo-rn-driver-screenshot';
import LifecycleModule from 'expo-rn-driver-lifecycle';

// Extend RNDriverGlobal type
export type RNDriverGlobal = {
  version: string;

  // Phase 2 - JS-only pointer simulation
  pointer: { ... };
  registerTouchHandler: (...) => void;
  unregisterTouchHandler: (...) => void;

  // Phase 3 - Native module bridges
  viewTree: {
    findByTestId: (testId: string) => Promise<NativeResult<ElementInfo>>;
    findByText: (text: string, exact?: boolean) => Promise<NativeResult<ElementInfo>>;
    findByRole: (role: string, name?: string) => Promise<NativeResult<ElementInfo>>;
    findAllByTestId: (testId: string) => Promise<NativeResult<ElementInfo[]>>;
    findAllByText: (text: string, exact?: boolean) => Promise<NativeResult<ElementInfo[]>>;
    findAllByRole: (role: string, name?: string) => Promise<NativeResult<ElementInfo[]>>;
    getBounds: (handle: string) => Promise<NativeResult<ElementBounds | null>>;
    isVisible: (handle: string) => Promise<NativeResult<boolean>>;
    isEnabled: (handle: string) => Promise<NativeResult<boolean>>;
  };

  screenshot: {
    captureScreen: () => Promise<NativeResult<string>>;
    captureElement: (handle: string) => Promise<NativeResult<string>>;
    captureRegion: (bounds: ElementBounds) => Promise<NativeResult<string>>;
  };

  lifecycle: {
    openURL: (url: string) => Promise<NativeResult<void>>;
    reload: () => Promise<NativeResult<void>>;
    background: () => Promise<NativeResult<void>>;
    foreground: () => Promise<NativeResult<void>>;
    getState: () => Promise<NativeResult<'active' | 'background' | 'inactive'>>;
  };

  // Feature detection
  capabilities: {
    viewTree: boolean;
    screenshot: boolean;
    lifecycle: boolean;
  };
};
```

### Capability Detection

```typescript
// In harness installation
function detectCapabilities(): Capabilities {
  return {
    viewTree: typeof ViewTreeModule?.findByTestId === 'function',
    screenshot: typeof ScreenshotModule?.captureScreen === 'function',
    lifecycle: typeof LifecycleModule?.openURL === 'function',
  };
}

// Driver can check before calling
if (!global.__RN_DRIVER__.capabilities.viewTree) {
  throw new NativeModuleRequiredError('getByTestId', 'expo-rn-driver-view-tree');
}
```

---

## Driver Integration

The driver's Locator implementation calls through to native modules:

```typescript
// src/locator.ts (Phase 3 implementation)

export class LocatorImpl implements Locator {
  private readonly device: RNDevice;
  private readonly selector: LocatorSelector;
  private cachedHandle: ElementHandle | null = null;

  async tap(): Promise<void> {
    const info = await this.resolve();
    const center = {
      x: info.bounds.x + info.bounds.width / 2,
      y: info.bounds.y + info.bounds.height / 2,
    };
    await this.device.pointer.tap(center.x, center.y);
  }

  async bounds(): Promise<ElementBounds | null> {
    const info = await this.resolve();
    return info.bounds;
  }

  async isVisible(): Promise<boolean> {
    const result = await this.query();
    return result.success && result.data.visible;
  }

  private async resolve(): Promise<ElementInfo> {
    const result = await this.query();
    if (!result.success) {
      throw new LocatorError(result.error, result.code);
    }
    return result.data;
  }

  private async query(): Promise<NativeResult<ElementInfo>> {
    const expr = this.buildQueryExpression();
    return this.device.evaluate<NativeResult<ElementInfo>>(expr);
  }

  private buildQueryExpression(): string {
    switch (this.selector.type) {
      case 'testId':
        return `global.__RN_DRIVER__.viewTree.findByTestId(${JSON.stringify(this.selector.value)})`;
      case 'text':
        return `global.__RN_DRIVER__.viewTree.findByText(${JSON.stringify(this.selector.value)}, ${this.selector.exact})`;
      case 'role':
        return `global.__RN_DRIVER__.viewTree.findByRole(${JSON.stringify(this.selector.value)}, ${JSON.stringify(this.selector.name)})`;
    }
  }
}
```

---

## Package Structure (Monorepo)

All packages live in a single repository for easier coordination and atomic updates:

```
rn-playwright-driver/                      # Monorepo root
├── packages/
│   ├── driver/                            # @0xbigboss/rn-playwright-driver
│   │   ├── src/
│   │   │   ├── cdp/
│   │   │   ├── device.ts
│   │   │   ├── locator.ts
│   │   │   ├── pointer.ts
│   │   │   └── test.ts
│   │   ├── harness/
│   │   │   └── index.ts                   # Extended for Phase 3
│   │   └── package.json
│   │
│   ├── view-tree/                         # @0xbigboss/rn-driver-view-tree
│   │   ├── ios/
│   │   │   └── RNDriverViewTreeModule.swift
│   │   ├── android/
│   │   │   └── src/main/java/expo/modules/rndriverviewtree/
│   │   │       └── RNDriverViewTreeModule.kt
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── RNDriverViewTreeModule.ts
│   │   ├── expo-module.config.json
│   │   └── package.json
│   │
│   ├── screenshot/                        # @0xbigboss/rn-driver-screenshot
│   │   ├── ios/
│   │   │   └── RNDriverScreenshotModule.swift
│   │   ├── android/
│   │   │   └── src/main/java/expo/modules/rndriverscreenshot/
│   │   │       └── RNDriverScreenshotModule.kt
│   │   ├── src/
│   │   │   └── ...
│   │   ├── expo-module.config.json
│   │   └── package.json
│   │
│   └── lifecycle/                         # @0xbigboss/rn-driver-lifecycle
│       ├── ios/
│       │   └── RNDriverLifecycleModule.swift
│       ├── android/
│       │   └── src/main/java/expo/modules/rndriverlifecycle/
│       │       └── RNDriverLifecycleModule.kt
│       ├── src/
│       │   └── ...
│       ├── expo-module.config.json
│       └── package.json
│
├── example/                               # Example Expo app for testing
│   ├── App.tsx
│   ├── e2e/
│   └── package.json
│
├── package.json                           # Workspace root
└── bun.lockb
```

### Workspace Configuration

```json
// package.json (root)
{
  "name": "rn-playwright-driver-monorepo",
  "private": true,
  "workspaces": [
    "packages/*",
    "example"
  ]
}
```

---

## Error Handling Strategy

### Consistent Error Codes

All native modules return `NativeResult<T>` with standardized error codes:

| Code | Meaning | Recovery |
|------|---------|----------|
| `NOT_FOUND` | No element matches query | Check selector, use waitFor |
| `MULTIPLE_FOUND` | Multiple matches for singular query | Use more specific selector |
| `NOT_VISIBLE` | Element exists but off-screen | Scroll into view first |
| `NOT_ENABLED` | Element visible but disabled | Wait for enabled state |
| `TIMEOUT` | Operation exceeded time limit | Increase timeout or fix app |
| `INTERNAL` | Unexpected native error | Report bug with stack trace |
| `NOT_SUPPORTED` | Platform doesn't support feature | Use alternative approach |

### Error Propagation

```
Native Module Error
       │
       ▼
NativeResult { success: false, error: "...", code: "..." }
       │
       ▼
Harness returns NativeResult to CDP evaluate
       │
       ▼
Driver checks result.success
       │
       ├─── true ──▶ Return result.data
       │
       └─── false ─▶ Throw LocatorError(result.error, result.code)
```

---

## Testing Strategy

### Unit Tests (per module)

```typescript
// expo-rn-driver-view-tree/__tests__/ViewTreeModule.test.ts
describe('ViewTreeModule', () => {
  it('finds element by testId', async () => {
    const result = await ViewTreeModule.findByTestId('submit-button');
    expect(result.success).toBe(true);
    expect(result.data.testId).toBe('submit-button');
  });

  it('returns NOT_FOUND for missing element', async () => {
    const result = await ViewTreeModule.findByTestId('nonexistent');
    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
  });
});
```

### Integration Tests (driver + modules)

```typescript
// Example project e2e tests
test('locator finds element and taps', async ({ device }) => {
  const button = device.getByTestId('increment');
  await button.tap();

  const count = await device.evaluate<string>(
    `global.__RN_DRIVER__.viewTree.findByTestId('count').data.text`
  );
  expect(count).toBe('1');
});
```

---

## Implementation Order

1. **expo-rn-driver-view-tree** (highest value)
   - Enables all locator functionality
   - Unblocks getByTestId, getByText, getByRole
   - Start with findByTestId, expand from there

2. **expo-rn-driver-screenshot** (visual testing)
   - Enables screenshot comparison
   - Foundation for visual regression testing
   - Relatively isolated implementation

3. **expo-rn-driver-lifecycle** (convenience)
   - Enables app state control
   - Nice-to-have for complex test scenarios
   - Can be deferred if needed

---

## Design Decisions

### 1. Monorepo Structure

All packages live in a single repository:
- Easier coordination between driver and native modules
- Atomic updates across packages
- Shared tooling (biome, tsgo, lefthook)
- Single version bump for breaking changes

### 2. JS Harness for Touch (No Native Touch Injection)

Touch simulation continues to use the Phase 2 JS harness approach:
- Already works reliably
- Simpler than native touch synthesis (UITouch, MotionEvent)
- Supports framework adapters (R3F, etc.) via `registerTouchHandler`
- Native touch injection can be added later if needed

### 3. Random IDs for Element Handles

Element handles use random hex identifiers:
- Format: `element_{16-char-hex}` (e.g., `element_a1b2c3d4e5f67890`)
- Generated on native side when element is found
- Stored in a WeakMap keyed by native view reference
- Handles are invalidated when view is unmounted

### 4. Fresh View Tree Queries (No Caching)

Each query traverses the view tree fresh:
- Always accurate, no staleness bugs
- Simpler implementation
- RN view trees are shallow enough that performance is acceptable
- Caching can be added later if profiling shows need

---

## Handle Management

Element handles provide stable references to native views across the CDP boundary.

### Native Side Implementation

```swift
// iOS: RNDriverViewTreeModule.swift
class RNDriverViewTreeModule: Module {
  // WeakMap: handle → weak view reference
  private var handleToView = NSMapTable<NSString, UIView>.strongToWeakObjects()
  // Reverse lookup for reusing handles
  private var viewToHandle = NSMapTable<UIView, NSString>.weakToStrongObjects()

  private func getOrCreateHandle(for view: UIView) -> String {
    // Reuse existing handle if view already tracked
    if let existing = viewToHandle.object(forKey: view) {
      return existing as String
    }

    // Generate new handle
    let handle = "element_\(UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(16))"
    handleToView.setObject(view, forKey: handle as NSString)
    viewToHandle.setObject(handle as NSString, forKey: view)
    return handle
  }

  private func resolveHandle(_ handle: String) -> UIView? {
    return handleToView.object(forKey: handle as NSString)
  }
}
```

```kotlin
// Android: RNDriverViewTreeModule.kt
class RNDriverViewTreeModule : Module() {
  // WeakHashMap: View → handle (auto-cleans when view is GC'd)
  private val viewToHandle = WeakHashMap<View, String>()
  // Regular map for reverse lookup (cleaned manually)
  private val handleToView = mutableMapOf<String, WeakReference<View>>()

  private fun getOrCreateHandle(view: View): String {
    // Reuse existing handle if view already tracked
    viewToHandle[view]?.let { return it }

    // Generate new handle
    val handle = "element_${UUID.randomUUID().toString().replace("-", "").take(16)}"
    viewToHandle[view] = handle
    handleToView[handle] = WeakReference(view)
    return handle
  }

  private fun resolveHandle(handle: String): View? {
    val ref = handleToView[handle] ?: return null
    val view = ref.get()
    if (view == null) {
      // View was garbage collected, clean up
      handleToView.remove(handle)
    }
    return view
  }
}
```

### Handle Lifecycle

1. **Creation**: Handle generated when element is first returned from a query
2. **Reuse**: Same view returns same handle across multiple queries
3. **Invalidation**: Handle becomes invalid when native view is deallocated
4. **Resolution**: `getBounds(handle)` / `isVisible(handle)` return null for invalid handles

---

## Touch Injection Architecture

The driver supports multiple touch injection backends, organized in tiers by capability level. This enables OS-level touch injection (like idb/adb) while maintaining fallback options for simpler setups.

### Two-Channel Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Test Runner (Node.js)                             │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                         RNDevice                                      │  │
│   │                                                                       │  │
│   │   CDP Channel ─────────────────────────────────────────────────────►  │  │
│   │   (element queries, screenshots, JS eval, lifecycle)                  │  │
│   │                                                                       │  │
│   │   Touch Channel ───────────────────────────────────────────────────►  │  │
│   │   (touch injection via selected backend)                              │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
           │                                         │
           │ CDP (WebSocket)                         │ Backend-specific
           │                                         │
           ▼                                         ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                          iOS Simulator / Device                                 │
│                                                                                 │
│   ┌──────────────────────────────────┐    ┌─────────────────────────────────┐  │
│   │      React Native App            │    │      Companion Process          │  │
│   │                                  │    │      (XCTest / Instrumentation) │  │
│   │   Hermes Runtime                 │    │                                 │  │
│   │   ├─ CDP endpoint                │    │   - WebSocket/HTTP Server       │  │
│   │   ├─ __RN_DRIVER__ harness       │    │   - OS-level touch injection    │  │
│   │   │  ├─ viewTree                 │    │   - System UI interaction       │  │
│   │   │  ├─ screenshot               │    │   - Keyboard input              │  │
│   │   │  ├─ lifecycle                │    │                                 │  │
│   │   │  └─ touchNative (optional)   │    │                                 │  │
│   │   └─ (CDP serves all queries)    │    │                                 │  │
│   └──────────────────────────────────┘    └──────────────────┬──────────────┘  │
│                  ▲                                           │                  │
│                  │         Kernel-level injection            │                  │
│                  └───────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Touch Backend Tiers

| Tier | Backend | Injection Level | System UI | Network | Requirements |
|------|---------|-----------------|-----------|---------|--------------|
| 1 | XCTest (iOS) / Instrumentation (Android) | Kernel (IOHIDEvent / UiAutomation) | ✅ | ❌ Local | Companion process |
| 2 | Native Module (RNDriverTouchInjector) | App (UIKit / MotionEvent) | ❌ | ✅ | Native module in app |
| 3 | CLI (idb / adb) | Kernel | ✅ | ❌ Local | Tools installed |
| 4 | JS Harness | Synthetic (React events) | ❌ | ✅ | Harness import only |

### Backend Selection

```typescript
type TouchBackendType = "xctest" | "instrumentation" | "native-module" | "cli" | "harness";

type TouchBackendConfig = {
  /** Selection mode (default: "auto") */
  mode?: "auto" | "force";
  /** Force a specific backend when mode === "force" */
  backend?: TouchBackendType;
  /** Ordered backend preference when mode === "auto" */
  order?: TouchBackendType[];
  /** Per-backend configuration */
  xctest?: {
    enabled?: boolean;
    host?: string;
    port?: number;
    connectTimeoutMs?: number;
    requestTimeoutMs?: number;
  };
  instrumentation?: {
    enabled?: boolean;
    host?: string;
    port?: number;
    connectTimeoutMs?: number;
    requestTimeoutMs?: number;
  };
  nativeModule?: { enabled?: boolean };
  cli?: { enabled?: boolean };
  harness?: { enabled?: boolean };
};
```

**Auto-selection logic** (default):

The driver tries backends in platform-specific order until one successfully initializes:

- **iOS**: `xctest` → `native-module` → `cli` → `harness`
- **Android**: `instrumentation` → `native-module` → `cli` → `harness`

For each backend:
1. Check if supported on current platform (e.g., `xctest` is iOS-only)
2. Check if enabled in config (all enabled by default)
3. Attempt to initialize (connect and send `hello` command)
4. If init succeeds, use that backend; if fails, try next in order

In `"force"` mode, only the specified backend is tried and errors are thrown immediately.

---

### Module 4: RNDriverTouchInjector

**Purpose**: In-app touch synthesis using platform APIs.

**Package**: `@0xbigboss/rn-driver-touch-injector`

#### API

```typescript
interface TouchInjectorModule {
  /** Tap at coordinates */
  tap(x: number, y: number): Promise<NativeResult<void>>;

  /** Press down at coordinates */
  down(x: number, y: number): Promise<NativeResult<void>>;

  /** Move while pressed */
  move(x: number, y: number): Promise<NativeResult<void>>;

  /** Release press */
  up(): Promise<NativeResult<void>>;

  /** Swipe between points */
  swipe(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    durationMs: number
  ): Promise<NativeResult<void>>;

  /** Long press at coordinates */
  longPress(x: number, y: number, durationMs: number): Promise<NativeResult<void>>;

  /** Type text (requires focused input) */
  typeText(text: string): Promise<NativeResult<void>>;
}
```

#### Platform Implementation

**iOS (Swift)** - Uses `UIApplication.sendEvent()` with synthesized `UITouch`/`UIEvent`:

```swift
// Synthesize touch via UIKit event dispatch
func synthesizeTap(at point: CGPoint) {
  guard let window = UIApplication.shared.windows.first,
        let hitView = window.hitTest(point, with: nil) else { return }

  // Create UITouch and UIEvent via KVC (same approach as KIF/EarlGrey)
  let touch = createTouch(at: point, in: window, view: hitView, phase: .began)
  let event = createTouchEvent(with: touch)

  UIApplication.shared.sendEvent(event)

  // ... dispatch .ended phase
}
```

**Android (Kotlin)** - Uses `view.dispatchTouchEvent()` with `MotionEvent`:

```kotlin
// Synthesize touch via View event dispatch
fun synthesizeTap(x: Float, y: Float) {
  val view = findViewAt(activity.window.decorView, x, y) ?: return

  val downTime = SystemClock.uptimeMillis()
  val down = MotionEvent.obtain(downTime, downTime, MotionEvent.ACTION_DOWN, x, y, 0)
  view.dispatchTouchEvent(down)
  down.recycle()

  val up = MotionEvent.obtain(downTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, x, y, 0)
  view.dispatchTouchEvent(up)
  up.recycle()
}
```

#### Capabilities vs Limitations

| Capability | Native Module | OS-Level (XCTest/Instrumentation) |
|------------|---------------|-----------------------------------|
| Tap app UI | ✅ | ✅ |
| Swipe/scroll | ✅ | ✅ |
| Gesture recognizers | ✅ Works | ✅ Works |
| System dialogs | ❌ | ✅ |
| Keyboard input | ❌ Limited | ✅ Full |
| Other apps | ❌ | ✅ |
| Network testing | ✅ | ❌ Local only |

---

### XCTest Companion (iOS)

**Purpose**: OS-level touch injection via XCUITest framework.

**Package**: `@0xbigboss/rn-playwright-driver-xctest-companion`

The XCTest companion runs as a separate XCTest bundle that:
1. Launches a WebSocket server
2. Receives touch commands from the driver
3. Executes via `XCUICoordinate` which uses `IOHIDEvent` for kernel-level injection

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    XCTest Runner Process                         │
│                                                                  │
│   Entitlements:                                                  │
│   - com.apple.springboard.debugapplications                      │
│   - Access to IOKit (IOHIDEventSystemClient)                     │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │  WebSocket Server (:9999)                                 │  │
│   │  ├─ Receives: { id, type: "tap", x, y }                  │  │
│   │  └─ Executes: XCUICoordinate.tap()                       │  │
│   └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │  XCUIApplication                                          │  │
│   │  ├─ coordinate(withNormalizedOffset:)                    │  │
│   │  ├─ .tap()                                               │  │
│   │  └─ .press(forDuration:thenDragTo:)                      │  │
│   └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │  IOHIDEventSystemClient                                   │  │
│   │  (Kernel-level touch injection)                           │  │
│   └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

#### Protocol

```typescript
// WebSocket message format (JSON)
// Request: { id, type, ...params }
// Response: { id, ok: true, result? } or { id, ok: false, error: { message, code? } }

type TouchRequest =
  | { id: number; type: "hello"; protocolVersion: number; client: string }
  | { id: number; type: "tap"; x: number; y: number }
  | { id: number; type: "down"; x: number; y: number }
  | { id: number; type: "move"; x: number; y: number }
  | { id: number; type: "up" }
  | { id: number; type: "swipe"; from: Point; to: Point; durationMs: number }
  | { id: number; type: "longPress"; x: number; y: number; durationMs: number }
  | { id: number; type: "typeText"; text: string };

type TouchResponse =
  | { id: number; ok: true; result?: unknown }
  | { id: number; ok: false; error: { message: string; code?: string } };
```

#### Setup

The XCTest companion is a reference implementation to integrate into your app's UI test target. See `packages/xctest-companion/README.md` for integration instructions.

Once integrated into your test target, run your UI test scheme to start the companion server.

---

### Instrumentation Companion (Android)

**Purpose**: OS-level touch injection via UiAutomation framework.

**Package**: `@0xbigboss/rn-playwright-driver-instrumentation-companion`

The Instrumentation companion runs as a test APK that:
1. Launches an HTTP server
2. Receives touch commands from the driver
3. Executes via `UiAutomation.injectInputEvent()` for kernel-level injection

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Instrumentation Process                       │
│                                                                  │
│   Permissions:                                                   │
│   - android.permission.INJECT_EVENTS (via Instrumentation)       │
│   - Access to /dev/input/* (via UiAutomation)                   │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │  HTTP Server (:9999)                                      │  │
│   │  ├─ POST /command { type: "tap", x, y }                  │  │
│   │  └─ Executes: UiAutomation.injectInputEvent()            │  │
│   └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │  UiAutomation                                             │  │
│   │  ├─ injectInputEvent(MotionEvent, sync: true)            │  │
│   │  └─ executeShellCommand("input tap ...")                 │  │
│   └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │  Linux Input Subsystem                                    │  │
│   │  (Kernel-level touch injection)                           │  │
│   └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

#### Protocol

```typescript
// HTTP POST /command with JSON body
// Request: { type, ...params }
// Response: { ok: true } or { ok: false, error: { message, code? } }

type TouchCommand =
  | { type: "hello" }
  | { type: "tap"; x: number; y: number }
  | { type: "down"; x: number; y: number }
  | { type: "move"; x: number; y: number }
  | { type: "up" }
  | { type: "swipe"; from: Point; to: Point; durationMs: number }
  | { type: "longPress"; x: number; y: number; durationMs: number }
  | { type: "typeText"; text: string };

type TouchResponse =
  | { ok: true }
  | { ok: false; error: { message: string; code?: string } };
```

#### Setup

```bash
# Install and start Instrumentation companion
# See packages/instrumentation-companion/README.md for build instructions
adb shell am instrument -w \
  com.your.test/com.rndriver.touchcompanion.RNDriverTouchCompanion
```

---

### TouchBackend Interface

All backends implement a common interface:

```typescript
interface TouchBackend {
  /** Backend identifier for debugging */
  readonly name: string;

  /** Initialize the backend (verify connectivity, etc.) */
  init(): Promise<void>;

  /** Cleanup resources */
  dispose(): Promise<void>;

  /** Single tap at coordinates */
  tap(x: number, y: number): Promise<void>;

  /** Press down at coordinates */
  down(x: number, y: number): Promise<void>;

  /** Move while pressed */
  move(x: number, y: number): Promise<void>;

  /** Release press */
  up(): Promise<void>;

  /** Swipe from one point to another */
  swipe(from: Point, to: Point, durationMs: number): Promise<void>;

  /** Long press at coordinates */
  longPress(x: number, y: number, durationMs: number): Promise<void>;

  /** Type text */
  typeText(text: string): Promise<void>;
}
```

### Backend Implementations

| Backend | Class | Connection |
|---------|-------|------------|
| XCTest | `XCTestTouchBackend` | WebSocket to companion |
| Instrumentation | `InstrumentationTouchBackend` | HTTP to companion |
| Native Module | `NativeModuleTouchBackend` | CDP evaluate to harness |
| CLI | `CliTouchBackend` | Spawn idb/adb |
| Harness | `HarnessTouchBackend` | CDP evaluate to harness |

### Package Structure

```
packages/
├── driver/
│   └── src/
│       └── touch/
│           ├── backend.ts              # TouchBackend interface
│           ├── harness-backend.ts      # JS harness implementation
│           ├── native-module-backend.ts # RNDriverTouchInjector implementation
│           ├── xctest-backend.ts       # XCTest companion client
│           ├── instrumentation-backend.ts # Instrumentation companion client
│           ├── cli-backend.ts          # idb/adb CLI wrapper
│           └── index.ts                # Factory + exports
│
├── touch-injector/                     # @0xbigboss/rn-driver-touch-injector
│   ├── ios/
│   │   └── RNDriverTouchInjectorModule.swift
│   ├── android/
│   │   └── .../RNDriverTouchInjectorModule.kt
│   └── package.json
│
├── xctest-companion/                   # @0xbigboss/rn-playwright-driver-xctest-companion
│   ├── ios/RNDriverTouchCompanion.swift
│   └── README.md
│
└── instrumentation-companion/          # @0xbigboss/rn-playwright-driver-instrumentation-companion
    ├── android/.../RNDriverTouchCompanion.kt
    └── README.md
```
