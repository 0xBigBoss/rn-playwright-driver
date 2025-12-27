import { NativeModuleRequiredError } from "./device";
import type { ElementBounds, Locator } from "./types";

const NATIVE_MODULE = "RNDriverViewTree";

/**
 * Selector types for locating elements.
 */
export type LocatorSelector =
  | { type: "testId"; value: string }
  | { type: "text"; value: string; exact: boolean }
  | { type: "role"; value: string; name?: string };

/**
 * Interface for device that supports evaluate().
 * Avoids circular dependency with Device type.
 */
interface Evaluator {
  evaluate<T>(expression: string): Promise<T>;
}

/**
 * Locator implementation for finding and interacting with RN views.
 *
 * IMPORTANT: All Locator methods require native modules (Phase 3).
 * In Phase 1-2, use device.pointer.* with coordinates from device.evaluate().
 */
export class LocatorImpl implements Locator {
  /** @internal Device reference for Phase 3 implementation */
  readonly device: Evaluator;
  private readonly selector: LocatorSelector;

  constructor(device: Evaluator, selector: LocatorSelector) {
    this.device = device;
    this.selector = selector;
  }

  /**
   * Tap the element center.
   * REQUIRES: RNDriverViewTree + RNDriverTouch (Phase 3)
   */
  async tap(): Promise<void> {
    throw new NativeModuleRequiredError("locator.tap()", "RNDriverViewTree + RNDriverTouch");
  }

  /**
   * Type text into the element.
   * REQUIRES: RNDriverViewTree + RNDriverKeyboard (Phase 3)
   */
  async type(_text: string): Promise<void> {
    throw new NativeModuleRequiredError("locator.type()", "RNDriverViewTree + RNDriverKeyboard");
  }

  /**
   * Wait for element to exist in view tree.
   * REQUIRES: RNDriverViewTree (Phase 3)
   */
  async waitFor(_options?: { timeout?: number }): Promise<void> {
    throw new NativeModuleRequiredError("locator.waitFor()", NATIVE_MODULE);
  }

  /**
   * Check if element exists and is visible.
   * REQUIRES: RNDriverViewTree (Phase 3)
   */
  async isVisible(): Promise<boolean> {
    throw new NativeModuleRequiredError("locator.isVisible()", NATIVE_MODULE);
  }

  /**
   * Get element bounds in logical points.
   * REQUIRES: RNDriverViewTree (Phase 3)
   */
  async bounds(): Promise<ElementBounds | null> {
    throw new NativeModuleRequiredError("locator.bounds()", NATIVE_MODULE);
  }

  /**
   * Capture screenshot of element.
   * REQUIRES: RNDriverScreenshot (Phase 3)
   */
  async screenshot(): Promise<Buffer> {
    throw new NativeModuleRequiredError("locator.screenshot()", "RNDriverScreenshot");
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
