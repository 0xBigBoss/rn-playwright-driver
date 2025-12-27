import type { ElementBounds, Locator } from "./types";

/**
 * Selector types for locating elements.
 */
export type LocatorSelector =
  | { type: "testId"; value: string }
  | { type: "text"; value: string; exact: boolean }
  | { type: "role"; value: string; name?: string };

/**
 * Interface for device that supports evaluate() and pointer.
 * Avoids circular dependency with Device type.
 */
interface Evaluator {
  evaluate<T>(expression: string): Promise<T>;
  pointer: {
    tap(x: number, y: number): Promise<void>;
  };
  waitForTimeout(ms: number): Promise<void>;
}

/**
 * Element info from native module.
 */
type ElementInfo = {
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
 * Result type from native module calls.
 */
type NativeResult<T> = { success: true; data: T } | { success: false; error: string; code: string };

/**
 * Error thrown when a locator operation fails.
 */
export class LocatorError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "LocatorError";
    this.code = code;
  }
}

const DEFAULT_WAIT_TIMEOUT = 30_000;
const DEFAULT_POLLING_INTERVAL = 100;

/**
 * Locator implementation for finding and interacting with RN views.
 * Uses native modules via the harness bridge when available.
 */
export class LocatorImpl implements Locator {
  /** @internal Device reference */
  readonly device: Evaluator;
  private readonly selector: LocatorSelector;

  constructor(device: Evaluator, selector: LocatorSelector) {
    this.device = device;
    this.selector = selector;
  }

  /**
   * Tap the element center.
   */
  async tap(): Promise<void> {
    const info = await this.resolve();
    const center = {
      x: info.bounds.x + info.bounds.width / 2,
      y: info.bounds.y + info.bounds.height / 2,
    };
    await this.device.pointer.tap(center.x, center.y);
  }

  /**
   * Type text into the element.
   * Note: Keyboard input requires additional native module (not yet implemented).
   */
  async type(_text: string): Promise<void> {
    // For now, we focus the element by tapping and rely on native keyboard
    // Full keyboard simulation would require another native module
    await this.tap();
    // TODO: Implement keyboard input via native module
    throw new LocatorError(
      "Keyboard input not yet implemented. Use device.evaluate() to set text directly.",
      "NOT_SUPPORTED",
    );
  }

  /**
   * Wait for element to exist in view tree.
   */
  async waitFor(options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout ?? DEFAULT_WAIT_TIMEOUT;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await this.query();
      if (result.success) {
        return;
      }

      await this.device.waitForTimeout(DEFAULT_POLLING_INTERVAL);
    }

    throw new LocatorError(
      `waitFor timed out after ${timeout}ms for ${this.toString()}`,
      "TIMEOUT",
    );
  }

  /**
   * Check if element exists and is visible.
   */
  async isVisible(): Promise<boolean> {
    const result = await this.query();
    return result.success && result.data.visible;
  }

  /**
   * Get element bounds in logical points.
   */
  async bounds(): Promise<ElementBounds | null> {
    const result = await this.query();
    if (!result.success) {
      return null;
    }
    return result.data.bounds;
  }

  /**
   * Capture screenshot of element.
   */
  async screenshot(): Promise<Buffer> {
    const info = await this.resolve();

    // Use the screenshot bridge to capture the region
    const result = await this.device.evaluate<NativeResult<string>>(`
      global.__RN_DRIVER__.screenshot.captureRegion({
        x: ${info.bounds.x},
        y: ${info.bounds.y},
        width: ${info.bounds.width},
        height: ${info.bounds.height}
      })
    `);

    if (!result.success) {
      throw new LocatorError(result.error, result.code);
    }

    // Decode base64 to Buffer
    return Buffer.from(result.data, "base64");
  }

  /**
   * Returns a string representation of the locator for debugging.
   */
  toString(): string {
    switch (this.selector.type) {
      case "testId":
        return `Locator(testId="${this.selector.value}")`;
      case "text":
        return `Locator(text="${this.selector.value}", exact=${this.selector.exact})`;
      case "role":
        return `Locator(role="${this.selector.value}"${this.selector.name ? `, name="${this.selector.name}"` : ""})`;
      default: {
        const _exhaustive: never = this.selector;
        throw new Error(`Unknown selector type: ${_exhaustive}`);
      }
    }
  }

  /**
   * Resolve the element, throwing if not found.
   */
  private async resolve(): Promise<ElementInfo> {
    const result = await this.query();
    if (!result.success) {
      throw new LocatorError(result.error, result.code);
    }
    return result.data;
  }

  /**
   * Query for the element using native module.
   */
  private async query(): Promise<NativeResult<ElementInfo>> {
    const expr = this.buildQueryExpression();
    return this.device.evaluate<NativeResult<ElementInfo>>(expr);
  }

  /**
   * Build the JS expression to call the harness viewTree bridge.
   */
  private buildQueryExpression(): string {
    switch (this.selector.type) {
      case "testId":
        return `global.__RN_DRIVER__.viewTree.findByTestId(${JSON.stringify(this.selector.value)})`;
      case "text":
        return `global.__RN_DRIVER__.viewTree.findByText(${JSON.stringify(this.selector.value)}, ${this.selector.exact})`;
      case "role": {
        const nameArg =
          this.selector.name !== undefined ? JSON.stringify(this.selector.name) : "undefined";
        return `global.__RN_DRIVER__.viewTree.findByRole(${JSON.stringify(this.selector.value)}, ${nameArg})`;
      }
    }
  }
}

/**
 * Create a locator for the given device and selector.
 */
export function createLocator(device: Evaluator, selector: LocatorSelector): Locator {
  return new LocatorImpl(device, selector);
}

/**
 * Re-export Locator type for external use.
 */
export type { Locator };
