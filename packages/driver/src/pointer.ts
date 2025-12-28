import type { PointerOptions } from "./types";

const DEFAULT_DRAG_STEPS = 10;
const DEFAULT_DRAG_DELAY = 0;

/**
 * Error thrown when the harness is not installed in the app.
 */
export class HarnessNotInstalledError extends Error {
  constructor() {
    super(
      "RN Driver harness not found. Add to your app entry:\n" +
        "  import '@0xbigboss/rn-playwright-driver/harness';",
    );
    this.name = "HarnessNotInstalledError";
  }
}

/**
 * Interface for device that supports evaluate().
 * Avoids circular dependency with Device type.
 */
interface Evaluator {
  evaluate<T>(expression: string): Promise<T>;
  waitForTimeout(ms: number): Promise<void>;
}

/**
 * Pointer/touch simulation via JS harness.
 *
 * Coordinates are in LOGICAL POINTS (same as RN's coordinate system).
 * Origin (0, 0) is top-left of the screen.
 */
export class Pointer {
  private readonly device: Evaluator;

  constructor(device: Evaluator) {
    this.device = device;
  }

  /**
   * Tap at coordinates (down + up).
   */
  async tap(x: number, y: number): Promise<void> {
    await this.ensureHarness();
    await this.device.evaluate<void>(`globalThis.__RN_DRIVER__.pointer.tap(${x}, ${y})`);
  }

  /**
   * Press down at coordinates.
   */
  async down(x: number, y: number): Promise<void> {
    await this.ensureHarness();
    await this.device.evaluate<void>(`globalThis.__RN_DRIVER__.pointer.down(${x}, ${y})`);
  }

  /**
   * Move to coordinates (while pressed).
   */
  async move(x: number, y: number): Promise<void> {
    await this.ensureHarness();
    await this.device.evaluate<void>(`globalThis.__RN_DRIVER__.pointer.move(${x}, ${y})`);
  }

  /**
   * Release press.
   */
  async up(): Promise<void> {
    await this.ensureHarness();
    await this.device.evaluate<void>(`globalThis.__RN_DRIVER__.pointer.up()`);
  }

  /**
   * Drag from one point to another with interpolation.
   */
  async drag(
    from: { x: number; y: number },
    to: { x: number; y: number },
    options?: PointerOptions,
  ): Promise<void> {
    await this.ensureHarness();

    const steps = options?.steps ?? DEFAULT_DRAG_STEPS;
    const delay = options?.delay ?? DEFAULT_DRAG_DELAY;

    // Press at start position
    await this.down(from.x, from.y);

    // Interpolate movement
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      await this.move(x, y);

      if (delay > 0) {
        await this.device.waitForTimeout(delay);
      }
    }

    // Release at end position
    await this.up();
  }

  /**
   * Check if the harness is installed in the app.
   * Throws HarnessNotInstalledError if not.
   */
  private async ensureHarness(): Promise<void> {
    const hasHarness = await this.device.evaluate<boolean>(
      `typeof globalThis.__RN_DRIVER__ !== 'undefined' && typeof globalThis.__RN_DRIVER__.pointer !== 'undefined'`,
    );

    if (!hasHarness) {
      throw new HarnessNotInstalledError();
    }
  }
}
