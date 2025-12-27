import type { TargetSelectionOptions } from "./cdp/discovery";

export type DeviceOptions = {
  /** Metro bundler URL (default: 'http://localhost:8081') */
  metroUrl?: string;
} & TargetSelectionOptions;

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

export type PointerOptions = {
  /** Number of interpolation steps for drag (default: 10) */
  steps?: number;
  /** Delay between steps in ms (default: 0) */
  delay?: number;
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
  /** Type text into the element. REQUIRES: RNDriverViewTree + keyboard (Phase 3) */
  type(text: string): Promise<void>;
  /** Wait for element to exist in view tree. REQUIRES: RNDriverViewTree (Phase 3) */
  waitFor(options?: { timeout?: number }): Promise<void>;
  /** Check if element exists and is visible. REQUIRES: RNDriverViewTree (Phase 3) */
  isVisible(): Promise<boolean>;
  /** Get element bounds in logical points. REQUIRES: RNDriverViewTree (Phase 3) */
  bounds(): Promise<ElementBounds | null>;
  /** Capture screenshot of element. REQUIRES: RNDriverScreenshot (Phase 3) */
  screenshot(): Promise<Buffer>;
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

  // --- Pointer/Touch (Phase 2 - via JS harness) ---
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
  };

  // --- Screenshots (Phase 3 - require native module) ---
  screenshot(options?: { clip?: ElementBounds }): Promise<Buffer>;

  // --- Navigation/Lifecycle (Phase 3 - require native module) ---
  openURL(url: string): Promise<void>;
  reload(): Promise<void>;
  background(): Promise<void>;
  foreground(): Promise<void>;

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

  // --- Platform Info ---
  readonly platform: "ios" | "android";
}
