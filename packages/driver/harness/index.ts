/**
 * RN Driver Harness - Install in your React Native app
 *
 * Usage:
 *   import '@0xbigboss/rn-playwright-driver/harness';
 *
 * This creates global.__RN_DRIVER__ with pointer simulation,
 * framework adapter registration, and native module bridges.
 */

/**
 * Touch event data passed to handlers.
 */
export type TouchEvent = {
  /** X position in logical points */
  x: number;
  /** Y position in logical points */
  y: number;
  /** Event type */
  type: "down" | "move" | "up";
  /** Timestamp when event was created */
  timestamp: number;
};

/**
 * Touch handler function type.
 */
export type TouchHandler = (event: TouchEvent) => void;

/**
 * Bounding rectangle in logical points.
 */
export type ElementBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Element information returned from view tree queries.
 */
export type ElementInfo = {
  handle: string;
  testId: string | null;
  text: string | null;
  role: string | null;
  label: string | null;
  bounds: ElementBounds;
  visible: boolean;
  enabled: boolean;
};

/**
 * Error codes for native module calls.
 */
export type ErrorCode =
  | "NOT_FOUND"
  | "MULTIPLE_FOUND"
  | "NOT_VISIBLE"
  | "NOT_ENABLED"
  | "TIMEOUT"
  | "INTERNAL"
  | "NOT_SUPPORTED"
  | "INVALID_URL";

/**
 * Standard result wrapper for native module calls.
 */
export type NativeResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: ErrorCode };

/**
 * App lifecycle states.
 */
export type AppState = "active" | "background" | "inactive";

/**
 * Capability flags for feature detection.
 */
export type Capabilities = {
  viewTree: boolean;
  screenshot: boolean;
  lifecycle: boolean;
};

/**
 * View tree bridge interface.
 */
export type ViewTreeBridge = {
  findByTestId: (testId: string) => Promise<NativeResult<ElementInfo>>;
  findByText: (text: string, exact?: boolean) => Promise<NativeResult<ElementInfo>>;
  findByRole: (role: string, name?: string) => Promise<NativeResult<ElementInfo>>;
  findAllByTestId: (testId: string) => Promise<NativeResult<ElementInfo[]>>;
  findAllByText: (text: string, exact?: boolean) => Promise<NativeResult<ElementInfo[]>>;
  findAllByRole: (role: string, name?: string) => Promise<NativeResult<ElementInfo[]>>;
  getBounds: (handle: string) => Promise<NativeResult<ElementBounds | null>>;
  isVisible: (handle: string) => Promise<NativeResult<boolean>>;
  isEnabled: (handle: string) => Promise<NativeResult<boolean>>;
  refresh: (handle: string) => Promise<NativeResult<ElementInfo | null>>;
};

/**
 * Screenshot bridge interface.
 */
export type ScreenshotBridge = {
  captureScreen: () => Promise<NativeResult<string>>;
  captureElement: (handle: string) => Promise<NativeResult<string>>;
  captureRegion: (bounds: ElementBounds) => Promise<NativeResult<string>>;
};

/**
 * Lifecycle bridge interface.
 */
export type LifecycleBridge = {
  openURL: (url: string) => Promise<NativeResult<void>>;
  reload: () => Promise<NativeResult<void>>;
  background: () => Promise<NativeResult<void>>;
  foreground: () => Promise<NativeResult<void>>;
  getState: () => Promise<NativeResult<AppState>>;
};

/**
 * Global driver interface exposed on global.__RN_DRIVER__.
 */
export type RNDriverGlobal = {
  /** Version of the harness */
  version: string;

  /** Pointer/touch simulation */
  pointer: {
    tap: (x: number, y: number) => void;
    down: (x: number, y: number) => void;
    move: (x: number, y: number) => void;
    up: () => void;
  };

  /**
   * Register a touch handler for a framework adapter.
   * Key is used to allow HMR updates (re-registration with same key replaces).
   */
  registerTouchHandler: (key: string, handler: TouchHandler) => void;

  /**
   * Unregister a touch handler.
   */
  unregisterTouchHandler: (key: string) => void;

  /** View tree native module bridge (Phase 3) */
  viewTree: ViewTreeBridge;

  /** Screenshot native module bridge (Phase 3) */
  screenshot: ScreenshotBridge;

  /** Lifecycle native module bridge (Phase 3) */
  lifecycle: LifecycleBridge;

  /** Feature detection */
  capabilities: Capabilities;

  /** Internal state (for debugging) */
  _internal: {
    handlers: Map<string, TouchHandler>;
    lastPosition: { x: number; y: number } | null;
    isDown: boolean;
  };
};

// Extend global type
declare global {
  // eslint-disable-next-line no-var
  var __RN_DRIVER__: RNDriverGlobal | undefined;
}

/**
 * Try to require a native module, returning null if not available.
 */
function tryRequireNativeModule<T>(moduleName: string): T | null {
  try {
    // Dynamic require for Expo modules
    const { requireNativeModule } = require("expo-modules-core");
    const mod = requireNativeModule(moduleName) as T;
    if (__DEV__) {
      console.log(`[RN_DRIVER] Loaded native module: ${moduleName}`);
    }
    return mod;
  } catch (error) {
    if (__DEV__) {
      console.warn(`[RN_DRIVER] Failed to load ${moduleName}:`, error);
    }
    return null;
  }
}

/**
 * Create error result for unavailable modules.
 */
function notSupportedResult<T>(feature: string): NativeResult<T> {
  return {
    success: false,
    error: `${feature} native module not installed`,
    code: "NOT_SUPPORTED",
  };
}

/**
 * Create and install the driver harness.
 */
function installHarness(): void {
  // Don't reinstall if already present (allows HMR)
  if (global.__RN_DRIVER__) {
    return;
  }

  const handlers = new Map<string, TouchHandler>();
  let lastPosition: { x: number; y: number } | null = null;
  let isDown = false;

  /**
   * Dispatch a touch event to all registered handlers.
   */
  function dispatchTouch(event: TouchEvent): void {
    for (const handler of handlers.values()) {
      try {
        handler(event);
      } catch (error) {
        console.error("[RN_DRIVER] Handler error:", error);
      }
    }
  }

  // Try to load native modules
  type ViewTreeNative = {
    findByTestId: (testId: string) => Promise<NativeResult<ElementInfo>>;
    findByText: (text: string, exact: boolean) => Promise<NativeResult<ElementInfo>>;
    findByRole: (role: string, name: string | null) => Promise<NativeResult<ElementInfo>>;
    findAllByTestId: (testId: string) => Promise<NativeResult<ElementInfo[]>>;
    findAllByText: (text: string, exact: boolean) => Promise<NativeResult<ElementInfo[]>>;
    findAllByRole: (role: string, name: string | null) => Promise<NativeResult<ElementInfo[]>>;
    getBounds: (handle: string) => Promise<NativeResult<ElementBounds | null>>;
    isVisible: (handle: string) => Promise<NativeResult<boolean>>;
    isEnabled: (handle: string) => Promise<NativeResult<boolean>>;
    refresh: (handle: string) => Promise<NativeResult<ElementInfo | null>>;
  };

  type ScreenshotNative = {
    captureScreen: () => Promise<NativeResult<string>>;
    captureElement: (handle: string) => Promise<NativeResult<string>>;
    captureRegion: (
      x: number,
      y: number,
      width: number,
      height: number,
    ) => Promise<NativeResult<string>>;
  };

  type LifecycleNative = {
    openURL: (url: string) => Promise<NativeResult<void>>;
    reload: () => Promise<NativeResult<void>>;
    background: () => Promise<NativeResult<void>>;
    foreground: () => Promise<NativeResult<void>>;
    getState: () => Promise<NativeResult<AppState>>;
  };

  const viewTreeNative = tryRequireNativeModule<ViewTreeNative>("RNDriverViewTree");
  const screenshotNative = tryRequireNativeModule<ScreenshotNative>("RNDriverScreenshot");
  const lifecycleNative = tryRequireNativeModule<LifecycleNative>("RNDriverLifecycle");

  // Create bridges with fallback error handling
  const viewTree: ViewTreeBridge = viewTreeNative
    ? {
        findByTestId: (testId) => viewTreeNative.findByTestId(testId),
        findByText: (text, exact = false) => viewTreeNative.findByText(text, exact),
        findByRole: (role, name) => viewTreeNative.findByRole(role, name ?? null),
        findAllByTestId: (testId) => viewTreeNative.findAllByTestId(testId),
        findAllByText: (text, exact = false) => viewTreeNative.findAllByText(text, exact),
        findAllByRole: (role, name) => viewTreeNative.findAllByRole(role, name ?? null),
        getBounds: (handle) => viewTreeNative.getBounds(handle),
        isVisible: (handle) => viewTreeNative.isVisible(handle),
        isEnabled: (handle) => viewTreeNative.isEnabled(handle),
        refresh: (handle) => viewTreeNative.refresh(handle),
      }
    : {
        findByTestId: async () => notSupportedResult("RNDriverViewTree"),
        findByText: async () => notSupportedResult("RNDriverViewTree"),
        findByRole: async () => notSupportedResult("RNDriverViewTree"),
        findAllByTestId: async () => notSupportedResult("RNDriverViewTree"),
        findAllByText: async () => notSupportedResult("RNDriverViewTree"),
        findAllByRole: async () => notSupportedResult("RNDriverViewTree"),
        getBounds: async () => notSupportedResult("RNDriverViewTree"),
        isVisible: async () => notSupportedResult("RNDriverViewTree"),
        isEnabled: async () => notSupportedResult("RNDriverViewTree"),
        refresh: async () => notSupportedResult("RNDriverViewTree"),
      };

  // captureElement is implemented via viewTree.getBounds + captureRegion orchestration
  const captureElementBridge = async (handle: string): Promise<NativeResult<string>> => {
    if (!viewTreeNative || !screenshotNative) {
      return notSupportedResult("RNDriverViewTree and RNDriverScreenshot");
    }

    // Get element bounds from view-tree module
    const boundsResult = await viewTreeNative.getBounds(handle);
    if (!boundsResult.success) {
      return boundsResult as NativeResult<string>;
    }

    const bounds = boundsResult.data;
    if (bounds === null) {
      return {
        success: false,
        error: `Element not found for handle: ${handle}`,
        code: "NOT_FOUND",
      };
    }

    // Capture the region at those bounds
    return screenshotNative.captureRegion(bounds.x, bounds.y, bounds.width, bounds.height);
  };

  const screenshot: ScreenshotBridge = screenshotNative
    ? {
        captureScreen: () => screenshotNative.captureScreen(),
        captureElement: captureElementBridge,
        captureRegion: (bounds) =>
          screenshotNative.captureRegion(bounds.x, bounds.y, bounds.width, bounds.height),
      }
    : {
        captureScreen: async () => notSupportedResult("RNDriverScreenshot"),
        captureElement: async () => notSupportedResult("RNDriverScreenshot"),
        captureRegion: async () => notSupportedResult("RNDriverScreenshot"),
      };

  const lifecycle: LifecycleBridge = lifecycleNative
    ? {
        openURL: (url) => lifecycleNative.openURL(url),
        reload: () => lifecycleNative.reload(),
        background: () => lifecycleNative.background(),
        foreground: () => lifecycleNative.foreground(),
        getState: () => lifecycleNative.getState(),
      }
    : {
        openURL: async () => notSupportedResult("RNDriverLifecycle"),
        reload: async () => notSupportedResult("RNDriverLifecycle"),
        background: async () => notSupportedResult("RNDriverLifecycle"),
        foreground: async () => notSupportedResult("RNDriverLifecycle"),
        getState: async () => notSupportedResult("RNDriverLifecycle"),
      };

  const capabilities: Capabilities = {
    viewTree: viewTreeNative !== null,
    screenshot: screenshotNative !== null,
    lifecycle: lifecycleNative !== null,
  };

  const harness: RNDriverGlobal = {
    version: "0.1.0",

    pointer: {
      tap(x: number, y: number): void {
        harness.pointer.down(x, y);
        harness.pointer.up();
      },

      down(x: number, y: number): void {
        lastPosition = { x, y };
        isDown = true;

        dispatchTouch({
          x,
          y,
          type: "down",
          timestamp: Date.now(),
        });
      },

      move(x: number, y: number): void {
        lastPosition = { x, y };

        dispatchTouch({
          x,
          y,
          type: "move",
          timestamp: Date.now(),
        });
      },

      up(): void {
        const position = lastPosition ?? { x: 0, y: 0 };
        isDown = false;

        dispatchTouch({
          x: position.x,
          y: position.y,
          type: "up",
          timestamp: Date.now(),
        });
      },
    },

    registerTouchHandler(key: string, handler: TouchHandler): void {
      handlers.set(key, handler);
    },

    unregisterTouchHandler(key: string): void {
      handlers.delete(key);
    },

    viewTree,
    screenshot,
    lifecycle,
    capabilities,

    _internal: {
      handlers,
      get lastPosition() {
        return lastPosition;
      },
      get isDown() {
        return isDown;
      },
    },
  };

  global.__RN_DRIVER__ = harness;

  if (__DEV__) {
    console.log("[RN_DRIVER] Harness installed", {
      capabilities,
    });
  }
}

// Declare __DEV__ for RN environment
declare const __DEV__: boolean | undefined;

// Install immediately on import
installHarness();
