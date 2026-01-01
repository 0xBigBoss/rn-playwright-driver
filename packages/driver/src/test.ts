import { test as base } from "@playwright/test";
import { createDevice, type RNDevice, type RNDeviceOptions } from "./device";
import type { Device, TouchBackendType } from "./types";

const DEFAULT_METRO_URL = "http://localhost:8081";
const DEFAULT_TIMEOUT = 30_000;

/**
 * Parse timeout string, returning undefined if invalid.
 */
function parseTimeout(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed;
}

/**
 * Valid touch backend types for validation.
 */
const VALID_TOUCH_BACKENDS: ReadonlySet<TouchBackendType> = new Set([
  "xctest",
  "instrumentation",
  "native-module",
  "cli",
  "harness",
]);

/**
 * Parse touch backend from environment variable.
 * Supports either a single backend name to force, or a comma-separated order.
 */
function parseTouchBackend(
  value: string | undefined,
): { mode: "force"; backend: TouchBackendType } | { order: TouchBackendType[] } | undefined {
  if (!value) return undefined;

  const parts = value.split(",").map((s) => s.trim().toLowerCase());

  // Validate all parts are valid backend types
  for (const part of parts) {
    if (!VALID_TOUCH_BACKENDS.has(part as TouchBackendType)) {
      console.warn(
        `Invalid touch backend: ${part}. Valid options: ${[...VALID_TOUCH_BACKENDS].join(", ")}`,
      );
      return undefined;
    }
  }

  // Single value = force mode, multiple = order preference
  if (parts.length === 1) {
    return { mode: "force", backend: parts[0] as TouchBackendType };
  }
  return { order: parts as TouchBackendType[] };
}

/**
 * Extended test fixtures for React Native testing.
 */
export type RNTestFixtures = {
  /** Connected device instance (worker-scoped, shared across tests) */
  device: Device;
};

export type RNWorkerFixtures = {
  /** Device options resolved from environment */
  deviceOptions: RNDeviceOptions;
  /** Worker-scoped device instance */
  _workerDevice: RNDevice;
};

/**
 * Create a custom test with RN device fixture.
 *
 * Configure via environment variables:
 * - RN_METRO_URL: Metro bundler URL (default: 'http://localhost:8081')
 * - RN_DEVICE_ID: Device ID to connect to
 * - RN_DEVICE_NAME: Device name to match (substring, case-insensitive)
 * - RN_TIMEOUT: Request timeout in ms (default: 30000)
 * - RN_TOUCH_BACKEND: Touch backend to use (e.g., 'harness' to force harness backend,
 *                     or 'harness,native-module' for preference order)
 *
 * Usage in test files:
 * ```ts
 * import { test, expect } from '@0xbigboss/rn-playwright-driver/test';
 *
 * test('app loads', async ({ device }) => {
 *   const result = await device.evaluate<number>('1 + 1');
 *   expect(result).toBe(2);
 * });
 * ```
 */
export const test = base.extend<RNTestFixtures, RNWorkerFixtures>({
  // Worker-scoped options from environment
  deviceOptions: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture pattern requires destructuring
    async ({}, use) => {
      const options: RNDeviceOptions = {
        metroUrl: process.env.RN_METRO_URL ?? DEFAULT_METRO_URL,
        timeout: parseTimeout(process.env.RN_TIMEOUT) ?? DEFAULT_TIMEOUT,
      };

      // Only set optional fields if they have values
      const deviceId = process.env.RN_DEVICE_ID;
      if (deviceId) {
        options.deviceId = deviceId;
      }

      const deviceName = process.env.RN_DEVICE_NAME;
      if (deviceName) {
        options.deviceName = deviceName;
      }

      // Configure touch backend if specified
      const touchBackend = parseTouchBackend(process.env.RN_TOUCH_BACKEND);
      if (touchBackend) {
        options.touch = touchBackend;
      }

      await use(options);
    },
    { scope: "worker" },
  ],

  // Worker-scoped device - created once per worker
  _workerDevice: [
    async ({ deviceOptions }, use) => {
      const device = createDevice(deviceOptions);
      await device.connect();
      await use(device);
      await device.disconnect();
    },
    { scope: "worker" },
  ],

  // Test-scoped device reference (points to worker device)
  device: async ({ _workerDevice }, use) => {
    await use(_workerDevice);
  },
});

/**
 * Re-export expect from Playwright for convenience.
 */
export { expect } from "@playwright/test";
export type {
  AssertionOptions,
  LocatorAssertions,
  SnapshotOptions,
  TextAssertionOptions,
} from "./expect";
/**
 * Locator-specific assertions with auto-retry.
 * Use this for RN locator assertions instead of Playwright's expect.
 *
 * @example
 * ```ts
 * import { test, expectLocator } from '@0xbigboss/rn-playwright-driver/test';
 *
 * test('button is visible', async ({ device }) => {
 *   const button = device.getByTestId('submit-button');
 *   await expectLocator(button).toBeVisible();
 * });
 * ```
 */
export { AssertionError, expect as expectLocator } from "./expect";

/**
 * Type for the test function with RN fixtures.
 */
export type RNTest = typeof test;
