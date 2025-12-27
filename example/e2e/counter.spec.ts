/**
 * Example E2E test for the counter app using @0xbigboss/rn-playwright-driver.
 *
 * NOTE: These tests require:
 * 1. The RN app running with Metro (bun start)
 * 2. A device connected with Hermes debugging enabled
 *
 * Run with: bun run test:e2e
 */

import { expect, test } from "@0xbigboss/rn-playwright-driver/test";

test.describe("Counter App", () => {
  test("harness is installed", async ({ device }) => {
    // Verify the harness is installed
    const hasHarness = await device.evaluate<boolean>(
      "typeof global.__RN_DRIVER__ !== 'undefined'",
    );
    expect(hasHarness).toBe(true);
  });

  test("can read harness version", async ({ device }) => {
    const version = await device.evaluate<string>("global.__RN_DRIVER__.version");
    expect(version).toBe("0.1.0");
  });

  test("can check app is running", async ({ device }) => {
    // Use ping to verify connection is alive
    const isAlive = await device.ping();
    expect(isAlive).toBe(true);
  });

  test("can detect platform", async ({ device }) => {
    // Platform should be detected from target metadata or JS
    expect(["ios", "android"]).toContain(device.platform);
  });

  test("can evaluate JS in app context", async ({ device }) => {
    // Simple arithmetic
    const result = await device.evaluate<number>("1 + 2 + 3");
    expect(result).toBe(6);
  });

  test("can access React Native Platform", async ({ device }) => {
    const platform = await device.evaluate<string>("require('react-native').Platform.OS");
    expect(["ios", "android"]).toContain(platform);
  });

  test("pointer tap simulates touch", async ({ device }) => {
    // Register a touch handler to verify taps are dispatched
    await device.evaluate<void>(`
      global.__testTouchCount = 0;
      global.__RN_DRIVER__.registerTouchHandler('test', (e) => {
        if (e.type === 'down') global.__testTouchCount++;
      });
    `);

    // Tap at a coordinate
    await device.pointer.tap(100, 200);

    // Verify touch was dispatched
    const touchCount = await device.evaluate<number>("global.__testTouchCount");
    expect(touchCount).toBe(1);

    // Clean up
    await device.evaluate<void>(`
      global.__RN_DRIVER__.unregisterTouchHandler('test');
      delete global.__testTouchCount;
    `);
  });

  test("pointer drag interpolates movement", async ({ device }) => {
    // Register handler to track move events
    await device.evaluate<void>(`
      global.__testMoveCount = 0;
      global.__RN_DRIVER__.registerTouchHandler('test', (e) => {
        if (e.type === 'move') global.__testMoveCount++;
      });
    `);

    // Drag with 5 steps
    await device.pointer.drag({ x: 0, y: 0 }, { x: 100, y: 100 }, { steps: 5 });

    // Should have 5 move events (one per step)
    const moveCount = await device.evaluate<number>("global.__testMoveCount");
    expect(moveCount).toBe(5);

    // Clean up
    await device.evaluate<void>(`
      global.__RN_DRIVER__.unregisterTouchHandler('test');
      delete global.__testMoveCount;
    `);
  });

  test("waitForFunction polls until truthy", async ({ device }) => {
    // Set up a delayed truthy value
    await device.evaluate<void>(`
      global.__testDelayed = false;
      setTimeout(() => { global.__testDelayed = true; }, 100);
    `);

    // Wait for it
    const result = await device.waitForFunction<boolean>("global.__testDelayed", {
      timeout: 5000,
      polling: 50,
    });

    expect(result).toBe(true);

    // Clean up
    await device.evaluate<void>("delete global.__testDelayed");
  });

  test("locator methods throw Phase 3 errors", async ({ device }) => {
    // Locator methods require native modules (Phase 3)
    const locator = device.getByTestId("counter");

    await expect(locator.tap()).rejects.toThrow("RNDriverViewTree + RNDriverTouch native module");
    await expect(locator.bounds()).rejects.toThrow("requires RNDriverViewTree native module");
    await expect(locator.isVisible()).rejects.toThrow("requires RNDriverViewTree native module");
  });

  test("screenshot throws Phase 3 error", async ({ device }) => {
    await expect(device.screenshot()).rejects.toThrow("requires RNDriverScreenshot native module");
  });
});
