/**
 * E2E tests for device.capabilities() API.
 *
 * Tests the capabilities detection functionality that reports
 * available native modules and harness features.
 */

import { expect, test } from "@0xbigboss/rn-playwright-driver/test";

test.describe("Device Capabilities", () => {
  test("capabilities() returns capability object", async ({ device }) => {
    const caps = await device.capabilities();

    // Should have all expected capability fields
    expect(caps).toHaveProperty("viewTree");
    expect(caps).toHaveProperty("screenshot");
    expect(caps).toHaveProperty("lifecycle");
    expect(caps).toHaveProperty("touchNative");
    expect(caps).toHaveProperty("pointer");
  });

  test("capabilities() returns boolean values", async ({ device }) => {
    const caps = await device.capabilities();

    expect(typeof caps.viewTree).toBe("boolean");
    expect(typeof caps.screenshot).toBe("boolean");
    expect(typeof caps.lifecycle).toBe("boolean");
    expect(typeof caps.touchNative).toBe("boolean");
    expect(typeof caps.pointer).toBe("boolean");
  });

  test("pointer capability is true when harness is installed", async ({ device }) => {
    const caps = await device.capabilities();

    // If harness is installed, pointer should be available
    const hasHarness = await device.evaluate<boolean>(
      "typeof globalThis.__RN_DRIVER__ !== 'undefined'",
    );

    if (hasHarness) {
      expect(caps.pointer).toBe(true);
    }
  });

  test("capabilities match harness-reported capabilities", async ({ device }) => {
    const deviceCaps = await device.capabilities();

    // Compare with direct harness query
    const harnessCaps = await device.evaluate<{
      viewTree: boolean;
      screenshot: boolean;
      lifecycle: boolean;
      touchNative: boolean;
      pointer: boolean;
    }>("globalThis.__RN_DRIVER__.capabilities");

    expect(deviceCaps.viewTree).toBe(harnessCaps.viewTree);
    expect(deviceCaps.screenshot).toBe(harnessCaps.screenshot);
    expect(deviceCaps.lifecycle).toBe(harnessCaps.lifecycle);
    expect(deviceCaps.pointer).toBe(harnessCaps.pointer);
  });
});
