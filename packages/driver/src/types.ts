import type { TargetSelectionOptions } from "./cdp/discovery";

export type DeviceOptions = {
  /** Metro bundler URL (default: 'http://localhost:8081') */
  metroUrl?: string;
  /** Touch backend selection and config */
  touch?: TouchBackendConfig;
} & TargetSelectionOptions;

// --- Wait states for Locator.waitFor ---

/** States for Locator.waitFor() */
export type WaitForState = "attached" | "visible" | "hidden" | "detached";

/** Options for Locator.waitFor() */
export interface WaitForOptions {
  /** Target state to wait for (default: "visible") */
  state?: WaitForState;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

// --- Capabilities detection ---

/** Capabilities reported by the harness */
export interface Capabilities {
  /** Native view tree module available */
  viewTree: boolean;
  /** Native screenshot module available */
  screenshot: boolean;
  /** Native lifecycle module available */
  lifecycle: boolean;
  /** Native touch injector module available */
  touchNative: boolean;
  /** JS pointer/touch harness available */
  pointer: boolean;
}

// --- Harness loading modes ---

/** How to load the test harness in the app */
export type HarnessLoadMode = "always" | "dev-only" | "explicit";

export type ElementBounds = {
  /** X position in logical points (not pixels) */
  x: number;
  /** Y position in logical points */
  y: number;
  /** Width in logical points */
  width: number;
  /** Height in logical points */
  height: number;
};

export type Point = {
  /** X position in logical points (not pixels) */
  x: number;
  /** Y position in logical points */
  y: number;
};

export type PointerOptions = {
  /** Number of interpolation steps for drag (default: 10) */
  steps?: number;
  /** Delay between steps in ms (default: 0) */
  delay?: number;
};

/** Options for swipe gesture */
export type SwipeOptions = {
  /** Starting point */
  from: Point;
  /** Ending point */
  to: Point;
  /** Duration in milliseconds (default: 300) */
  duration?: number;
};

export type TouchBackendType = "xctest" | "instrumentation" | "native-module" | "cli" | "harness";

// --- Window Metrics ---

/**
 * Window metrics for layout assertions and coordinate calculations.
 * All dimensions are in logical points (not physical pixels).
 */
export type WindowMetrics = {
  /** Screen width in logical points */
  width: number;
  /** Screen height in logical points */
  height: number;
  /** Device pixel ratio */
  pixelRatio: number;
  /** Alias for pixelRatio (matches RN PixelRatio.get()) */
  scale: number;
  /** Font scale factor (for accessibility) */
  fontScale: number;
  /** Current screen orientation */
  orientation: "portrait" | "landscape";
  /** Safe area insets (if available via react-native-safe-area-context or similar) */
  safeAreaInsets?: { top: number; right: number; bottom: number; left: number };
};

// --- Touch Backend Info ---

/**
 * Information about the selected touch backend.
 */
export type TouchBackendInfo = {
  /** Currently selected backend */
  selected: TouchBackendType;
  /** All available backends */
  available: TouchBackendType[];
  /** Reason for backend selection (for diagnostics) */
  reason?: string;
};

// --- Tracing ---

/**
 * Driver event types for tracing.
 */
export type DriverEventType =
  | "pointer:down"
  | "pointer:move"
  | "pointer:up"
  | "pointer:tap"
  | "locator:find"
  | "locator:tap"
  | "evaluate"
  | "console"
  | "error";

/**
 * A traced event from the driver.
 */
export type DriverEvent = {
  /** Event type */
  type: DriverEventType;
  /** Timestamp when event occurred */
  timestamp: number;
} & ({ /** Event-specific data */ data: Record<string, unknown> } | { data?: undefined });

/**
 * Tracing options.
 */
export type TracingOptions = {
  /** Include console logs in trace (default: false) */
  includeConsole?: boolean;
};

// --- Pointer Path Options ---

/**
 * Options for pointer path operations (dragPath, movePath).
 */
export type PointerPathOptions = {
  /** Delay between each point in ms (default: 0) */
  delay?: number;
};

export type TouchBackendMode = "auto" | "force";

export type TouchBackendConfig = {
  /** Selection mode (default: "auto") */
  mode?: TouchBackendMode;
  /** Force a specific backend when mode === "force" */
  backend?: TouchBackendType;
  /** Ordered backend preference when mode === "auto" */
  order?: TouchBackendType[];
  /** XCTest companion connection options */
  xctest?: {
    enabled?: boolean;
    host?: string;
    port?: number;
    connectTimeoutMs?: number;
    requestTimeoutMs?: number;
  };
  /** Android Instrumentation companion connection options */
  instrumentation?: {
    enabled?: boolean;
    host?: string;
    port?: number;
    connectTimeoutMs?: number;
    requestTimeoutMs?: number;
  };
  /** Enable native-module backend (requires RNDriverTouchInjector) */
  nativeModule?: {
    enabled?: boolean;
  };
  /** Enable CLI backend (idb/adb) */
  cli?: {
    enabled?: boolean;
  };
  /** Enable JS harness backend */
  harness?: {
    enabled?: boolean;
  };
};

/**
 * Locator for finding and interacting with RN views.
 *
 * IMPORTANT: Most Locator methods require native modules (Phase 3).
 * In Phase 1-2, use device.pointer.* with coordinates from device.evaluate().
 *
 * Methods will throw descriptive errors if called before native modules are available.
 */
export type Locator = {
  /** Tap the element center. REQUIRES: RNDriverViewTree + RNDriverTouch (Phase 3) */
  tap(): Promise<void>;
  /**
   * Type text into the element.
   * NOT YET IMPLEMENTED: Requires RNDriverKeyboard native module.
   * Use device.evaluate() with setNativeProps as workaround.
   * @throws LocatorError with code "NOT_SUPPORTED"
   */
  type(text: string): Promise<void>;
  /**
   * Wait for element to reach a specific state.
   * - "attached": element exists in the view tree
   * - "visible": element exists AND is visible
   * - "hidden": element exists but is NOT visible
   * - "detached": element does NOT exist
   * REQUIRES: RNDriverViewTree (Phase 3)
   */
  waitFor(options?: WaitForOptions): Promise<void>;
  /** Check if element exists and is visible. REQUIRES: RNDriverViewTree (Phase 3) */
  isVisible(): Promise<boolean>;
  /** Get element bounds in logical points. REQUIRES: RNDriverViewTree (Phase 3) */
  bounds(): Promise<ElementBounds | null>;
  /** Capture screenshot of element. REQUIRES: RNDriverScreenshot (Phase 3) */
  screenshot(): Promise<Buffer>;
  /**
   * Scroll the element into view.
   * NOT YET IMPLEMENTED: Requires native scroll integration.
   * Use device.evaluate() with scrollTo on ScrollView refs as workaround.
   * @throws LocatorError with code "NOT_SUPPORTED"
   */
  scrollIntoView(): Promise<void>;

  // --- Chaining methods ---
  /** Find element by testID within this element's subtree */
  getByTestId(testId: string): Locator;
  /** Find element containing text within this element's subtree */
  getByText(text: string, options?: { exact?: boolean }): Locator;
  /** Find element by accessibility role within this element's subtree */
  getByRole(role: string, options?: { name?: string }): Locator;
  /** Return the nth matching element (0-indexed) */
  nth(index: number): Locator;
  /** Return the first matching element */
  first(): Locator;
  /** Return the last matching element */
  last(): Locator;
};

/**
 * Coordinate system: All coordinates are in LOGICAL POINTS, not physical pixels.
 * Origin (0, 0) is top-left of the screen.
 * This matches RN's coordinate system and Playwright's default behavior.
 */
export interface Device {
  // --- Connection ---
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Health check - returns true if connection is alive */
  ping(): Promise<boolean>;

  // --- JS Evaluation (Phase 1 - the foundation) ---
  /**
   * Evaluate JS expression in app context.
   * Expression must be a string; for complex logic, define functions in the app.
   */
  evaluate<T>(expression: string): Promise<T>;

  // --- Locators (Phase 3 - require native modules) ---
  /**
   * Find element by testID prop.
   * Maps to accessibilityIdentifier on iOS, testID on Android.
   */
  getByTestId(testId: string): Locator;
  /**
   * Find element containing text.
   * Searches accessibilityLabel and Text component children.
   */
  getByText(text: string, options?: { exact?: boolean }): Locator;
  /**
   * Find element by accessibility role.
   * Maps to accessibilityRole prop.
   */
  getByRole(role: string, options?: { name?: string }): Locator;

  // --- Pointer/Touch (Phase 2 - via touch backend) ---
  /**
   * Pointer coordinates are in LOGICAL POINTS, same as RN's coordinate system.
   */
  pointer: {
    /** Tap at coordinates (down + up) */
    tap(x: number, y: number): Promise<void>;
    /** Press down at coordinates */
    down(x: number, y: number): Promise<void>;
    /** Move to coordinates (while pressed) */
    move(x: number, y: number): Promise<void>;
    /** Release press */
    up(): Promise<void>;
    /** Drag from one point to another with interpolation */
    drag(
      from: { x: number; y: number },
      to: { x: number; y: number },
      options?: PointerOptions,
    ): Promise<void>;
    /** Swipe from one point to another with duration-based animation */
    swipe(options: SwipeOptions): Promise<void>;
    /**
     * Execute a drag gesture along a path of points.
     * Performs down at first point, moves through all points, up at last point.
     */
    dragPath(points: { x: number; y: number }[], options?: PointerPathOptions): Promise<void>;
    /**
     * Move through a path of points without down/up.
     * Useful for hover effects or tracking gestures.
     */
    movePath(points: { x: number; y: number }[], options?: PointerPathOptions): Promise<void>;
  };

  // --- Screenshots (Phase 3 - require native module) ---
  screenshot(options?: { clip?: ElementBounds }): Promise<Buffer>;

  // --- Navigation/Lifecycle (Phase 3 - require native module) ---
  openURL(url: string): Promise<void>;
  reload(): Promise<void>;
  background(): Promise<void>;
  foreground(): Promise<void>;

  // --- Capabilities Detection ---
  /** Get available capabilities from the harness */
  capabilities(): Promise<Capabilities>;

  // --- Utilities (Phase 1) ---
  waitForTimeout(ms: number): Promise<void>;

  /**
   * Wait for a JS expression to return a truthy value.
   *
   * Semantics (matches Playwright):
   * - Polls the expression until it returns a truthy value
   * - Returns the truthy value (not just true)
   * - Throws TimeoutError if timeout expires
   * - If expression throws, the error propagates immediately (no retry)
   */
  waitForFunction<T>(
    expression: string,
    options?: { timeout?: number; polling?: number },
  ): Promise<T>;

  // --- Core Primitives ---

  /**
   * Get current window metrics (dimensions, pixel ratio, orientation).
   * All values are in logical points.
   */
  getWindowMetrics(): Promise<WindowMetrics>;

  /**
   * Get current RAF frame count from the harness.
   * Monotonically increasing counter incremented each requestAnimationFrame.
   */
  getFrameCount(): Promise<number>;

  /**
   * Wait for N animation frames to elapse.
   * @param count Number of frames to wait (default: 1)
   */
  waitForRaf(count?: number): Promise<void>;

  /**
   * Wait until the frame count reaches or exceeds the target value.
   * @param target Target frame count to wait for
   */
  waitForFrameCount(target: number): Promise<void>;

  /**
   * Get information about the currently selected touch backend.
   */
  getTouchBackendInfo(): Promise<TouchBackendInfo>;

  /**
   * Start tracing driver events.
   * Events are stored in a bounded ring buffer on the device.
   */
  startTracing(options?: TracingOptions): Promise<void>;

  /**
   * Stop tracing and return collected events.
   * Clears the trace buffer.
   */
  stopTracing(): Promise<{ events: DriverEvent[] }>;

  // --- Platform Info ---
  readonly platform: "ios" | "android";
}
