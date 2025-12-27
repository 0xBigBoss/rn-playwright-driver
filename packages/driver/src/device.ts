import { CDPClient, type CDPClientOptions } from "./cdp/client";
import { discoverTargets, selectTarget } from "./cdp/discovery";
import type { Locator, LocatorSelector } from "./locator";
import { createLocator, LocatorError } from "./locator";
import { Pointer } from "./pointer";
import type { Device, DeviceOptions, ElementBounds } from "./types";

const DEFAULT_METRO_URL = "http://localhost:8081";
const DEFAULT_WAIT_TIMEOUT = 30_000;
const DEFAULT_POLLING_INTERVAL = 100;

/**
 * Error thrown when an operation times out.
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Result type from native module calls.
 */
type NativeResult<T> = { success: true; data: T } | { success: false; error: string; code: string };

export type RNDeviceOptions = DeviceOptions & CDPClientOptions;

/**
 * React Native device implementation using CDP.
 */
export class RNDevice implements Device {
  private readonly options: RNDeviceOptions;
  private readonly cdp: CDPClient;
  private readonly _pointer: Pointer;
  private _platform: "ios" | "android" = "ios";

  constructor(options: RNDeviceOptions = {}) {
    const timeout = options.timeout ?? DEFAULT_WAIT_TIMEOUT;
    this.options = {
      metroUrl: options.metroUrl ?? DEFAULT_METRO_URL,
      timeout,
      ...options,
    };
    this.cdp = new CDPClient({ timeout });
    this._pointer = new Pointer(this);
  }

  // --- Connection ---

  async connect(): Promise<void> {
    const metroUrl = this.options.metroUrl ?? DEFAULT_METRO_URL;
    const targets = await discoverTargets(metroUrl);
    const target = selectTarget(targets, this.options);

    await this.cdp.connect(target.webSocketDebuggerUrl);

    // Detect platform from target info or via JS
    this._platform = await this.detectPlatform(target);
  }

  async disconnect(): Promise<void> {
    await this.cdp.disconnect();
  }

  async ping(): Promise<boolean> {
    return this.cdp.ping();
  }

  // --- JS Evaluation (Phase 1) ---

  async evaluate<T>(expression: string): Promise<T> {
    return this.cdp.evaluate<T>(expression);
  }

  // --- Locators (Phase 3) ---

  getByTestId(testId: string): Locator {
    return createLocator(this, { type: "testId", value: testId });
  }

  getByText(text: string, options?: { exact?: boolean }): Locator {
    return createLocator(this, {
      type: "text",
      value: text,
      exact: options?.exact ?? false,
    });
  }

  getByRole(role: string, options?: { name?: string }): Locator {
    const selector: LocatorSelector = { type: "role", value: role };
    if (options?.name !== undefined) {
      selector.name = options.name;
    }
    return createLocator(this, selector);
  }

  // --- Pointer/Touch (Phase 2) ---

  get pointer(): Pointer {
    return this._pointer;
  }

  // --- Screenshots (Phase 3) ---

  async screenshot(options?: { clip?: ElementBounds }): Promise<Buffer> {
    let result: NativeResult<string>;

    if (options?.clip) {
      // Capture specific region
      const { x, y, width, height } = options.clip;
      result = await this.evaluate<NativeResult<string>>(`
        global.__RN_DRIVER__.screenshot.captureRegion({
          x: ${x},
          y: ${y},
          width: ${width},
          height: ${height}
        })
      `);
    } else {
      // Capture full screen
      result = await this.evaluate<NativeResult<string>>(
        "global.__RN_DRIVER__.screenshot.captureScreen()",
      );
    }

    if (!result.success) {
      throw new LocatorError(result.error, result.code);
    }

    // Decode base64 to Buffer
    return Buffer.from(result.data, "base64");
  }

  // --- Navigation/Lifecycle (Phase 3) ---

  async openURL(url: string): Promise<void> {
    const result = await this.evaluate<NativeResult<void>>(
      `global.__RN_DRIVER__.lifecycle.openURL(${JSON.stringify(url)})`,
    );

    if (!result.success) {
      throw new LocatorError(result.error, result.code);
    }
  }

  async reload(): Promise<void> {
    const result = await this.evaluate<NativeResult<void>>(
      "global.__RN_DRIVER__.lifecycle.reload()",
    );

    if (!result.success) {
      throw new LocatorError(result.error, result.code);
    }
  }

  async background(): Promise<void> {
    const result = await this.evaluate<NativeResult<void>>(
      "global.__RN_DRIVER__.lifecycle.background()",
    );

    if (!result.success) {
      throw new LocatorError(result.error, result.code);
    }
  }

  async foreground(): Promise<void> {
    const result = await this.evaluate<NativeResult<void>>(
      "global.__RN_DRIVER__.lifecycle.foreground()",
    );

    if (!result.success) {
      throw new LocatorError(result.error, result.code);
    }
  }

  // --- Utilities (Phase 1) ---

  async waitForTimeout(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async waitForFunction<T>(
    expression: string,
    options?: { timeout?: number; polling?: number },
  ): Promise<T> {
    const timeout = options?.timeout ?? this.options.timeout ?? DEFAULT_WAIT_TIMEOUT;
    const polling = options?.polling ?? DEFAULT_POLLING_INTERVAL;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await this.evaluate<T>(expression);
      if (result) {
        return result;
      }
      await this.waitForTimeout(polling);
    }

    throw new TimeoutError(
      `waitForFunction timed out after ${timeout}ms: ${expression.slice(0, 100)}...`,
    );
  }

  // --- Platform Info ---

  get platform(): "ios" | "android" {
    return this._platform;
  }

  // --- Private helpers ---

  private async detectPlatform(target: {
    deviceName?: string;
    title?: string;
  }): Promise<"ios" | "android"> {
    // Try to detect from target metadata first
    const name = target.deviceName?.toLowerCase() ?? target.title?.toLowerCase() ?? "";
    if (name.includes("iphone") || name.includes("ipad") || name.includes("ios")) {
      return "ios";
    }
    if (name.includes("android") || name.includes("pixel") || name.includes("samsung")) {
      return "android";
    }

    // Fall back to JS detection
    try {
      const platform = await this.evaluate<string>("require('react-native').Platform.OS");
      if (platform === "ios" || platform === "android") {
        return platform;
      }
    } catch {
      // Ignore evaluation errors
    }

    // Default to iOS
    return "ios";
  }
}

/**
 * Create a device instance with the given options.
 */
export function createDevice(options?: RNDeviceOptions): RNDevice {
  return new RNDevice(options);
}
