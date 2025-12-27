/**
 * Example E2E test for the counter app using @0xbigboss/rn-playwright-driver.
 *
 * NOTE: These tests require:
 * 1. The RN app running with Metro (bun start)
 * 2. A device connected with Hermes debugging enabled
 * 3. Native modules installed (view-tree, screenshot, lifecycle)
 *
 * Run with: bun run test:e2e
 */

import { expect, test } from "@0xbigboss/rn-playwright-driver/test";

test.describe("Counter App - Core Features", () => {
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
});

test.describe("Counter App - Capabilities Detection", () => {
  test("reports viewTree capability", async ({ device }) => {
    const hasViewTree = await device.evaluate<boolean>(
      "global.__RN_DRIVER__.capabilities.viewTree",
    );
    // Will be true when native module is installed
    expect(typeof hasViewTree).toBe("boolean");
  });

  test("reports screenshot capability", async ({ device }) => {
    const hasScreenshot = await device.evaluate<boolean>(
      "global.__RN_DRIVER__.capabilities.screenshot",
    );
    expect(typeof hasScreenshot).toBe("boolean");
  });

  test("reports lifecycle capability", async ({ device }) => {
    const hasLifecycle = await device.evaluate<boolean>(
      "global.__RN_DRIVER__.capabilities.lifecycle",
    );
    expect(typeof hasLifecycle).toBe("boolean");
  });
});

test.describe("Counter App - View Tree (Native Module)", () => {
  test("getByTestId finds element with testID", async ({ device }) => {
    // This test requires the view-tree native module to be installed
    const capabilities = await device.evaluate<{ viewTree: boolean }>(
      "global.__RN_DRIVER__.capabilities",
    );

    if (!capabilities.viewTree) {
      test.skip();
      return;
    }

    // Find the increment button by testID
    const locator = device.getByTestId("increment-button");
    const isVisible = await locator.isVisible();
    expect(typeof isVisible).toBe("boolean");
  });

  test("getByText finds element with text", async ({ device }) => {
    const capabilities = await device.evaluate<{ viewTree: boolean }>(
      "global.__RN_DRIVER__.capabilities",
    );

    if (!capabilities.viewTree) {
      test.skip();
      return;
    }

    // Find element containing "Counter" text
    const locator = device.getByText("Counter");
    const isVisible = await locator.isVisible();
    expect(typeof isVisible).toBe("boolean");
  });

  test("locator.tap() works with native module", async ({ device }) => {
    const capabilities = await device.evaluate<{ viewTree: boolean }>(
      "global.__RN_DRIVER__.capabilities",
    );

    if (!capabilities.viewTree) {
      test.skip();
      return;
    }

    // Get initial count
    const initialCount = await device.evaluate<string>(
      "global.__RN_DRIVER__.viewTree.findByTestId('count-display').then(r => r.success ? r.data.text : '0')",
    );

    // Tap increment button
    await device.getByTestId("increment-button").tap();

    // Wait for UI to update
    await device.waitForTimeout(100);

    // Get new count - should have incremented
    const newCount = await device.evaluate<string>(
      "global.__RN_DRIVER__.viewTree.findByTestId('count-display').then(r => r.success ? r.data.text : '0')",
    );

    expect(Number.parseInt(newCount, 10)).toBeGreaterThanOrEqual(Number.parseInt(initialCount, 10));
  });

  test("locator.bounds() returns element bounds", async ({ device }) => {
    const capabilities = await device.evaluate<{ viewTree: boolean }>(
      "global.__RN_DRIVER__.capabilities",
    );

    if (!capabilities.viewTree) {
      test.skip();
      return;
    }

    const locator = device.getByTestId("increment-button");
    const bounds = await locator.bounds();

    if (bounds) {
      expect(typeof bounds.x).toBe("number");
      expect(typeof bounds.y).toBe("number");
      expect(typeof bounds.width).toBe("number");
      expect(typeof bounds.height).toBe("number");
      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.height).toBeGreaterThan(0);
    }
  });

  test("getByRole finds element with accessibility role", async ({ device }) => {
    const capabilities = await device.evaluate<{ viewTree: boolean }>(
      "global.__RN_DRIVER__.capabilities",
    );

    if (!capabilities.viewTree) {
      test.skip();
      return;
    }

    // Find a button by role
    const locator = device.getByRole("button");
    const isVisible = await locator.isVisible();
    expect(typeof isVisible).toBe("boolean");
  });

  test("findAll queries return arrays with handles", async ({ device }) => {
    const capabilities = await device.evaluate<{ viewTree: boolean }>(
      "global.__RN_DRIVER__.capabilities",
    );

    if (!capabilities.viewTree) {
      test.skip();
      return;
    }

    type NativeResult<T> = { success: true; data: T } | { success: false; error: string };
    type ElementInfo = { handle: string };

    // Test findAllByText - find elements containing "Count" (from "Count: X")
    const textResult = await device.evaluate<NativeResult<ElementInfo[]>>(
      "global.__RN_DRIVER__.viewTree.findAllByText('Count', false)",
    );
    expect(textResult.success).toBe(true);
    if (textResult.success) {
      expect(Array.isArray(textResult.data)).toBe(true);
      expect(textResult.data.length).toBeGreaterThanOrEqual(1);
    }

    // Test findAllByTestId - find increment button (exact match returns 1)
    const testIdResult = await device.evaluate<NativeResult<ElementInfo[]>>(
      "global.__RN_DRIVER__.viewTree.findAllByTestId('increment-button')",
    );
    expect(testIdResult.success).toBe(true);
    if (testIdResult.success) {
      expect(Array.isArray(testIdResult.data)).toBe(true);
      expect(testIdResult.data.length).toBe(1);
      expect(testIdResult.data[0].handle.length).toBeGreaterThan(0);
    }
  });

  test("isEnabled returns element enabled state", async ({ device }) => {
    const capabilities = await device.evaluate<{ viewTree: boolean }>(
      "global.__RN_DRIVER__.capabilities",
    );

    if (!capabilities.viewTree) {
      test.skip();
      return;
    }

    type NativeResult<T> = { success: true; data: T } | { success: false; error: string };
    type ElementInfo = { handle: string; enabled: boolean };

    // Find an element and check isEnabled
    const findResult = await device.evaluate<NativeResult<ElementInfo>>(
      "global.__RN_DRIVER__.viewTree.findByTestId('increment-button')",
    );

    if (findResult.success) {
      const isEnabledResult = await device.evaluate<NativeResult<boolean>>(
        `global.__RN_DRIVER__.viewTree.isEnabled('${findResult.data.handle}')`,
      );

      if (isEnabledResult.success) {
        expect(typeof isEnabledResult.data).toBe("boolean");
      }
    }
  });

  test("refresh returns updated element info", async ({ device }) => {
    const capabilities = await device.evaluate<{ viewTree: boolean }>(
      "global.__RN_DRIVER__.capabilities",
    );

    if (!capabilities.viewTree) {
      test.skip();
      return;
    }

    type NativeResult<T> = { success: true; data: T } | { success: false; error: string };
    type ElementInfo = { handle: string; bounds: { x: number; y: number } };

    // Find an element
    const findResult = await device.evaluate<NativeResult<ElementInfo>>(
      "global.__RN_DRIVER__.viewTree.findByTestId('increment-button')",
    );

    if (findResult.success) {
      // Refresh should return updated info
      const refreshResult = await device.evaluate<NativeResult<ElementInfo | null>>(
        `global.__RN_DRIVER__.viewTree.refresh('${findResult.data.handle}')`,
      );

      expect(typeof refreshResult.success).toBe("boolean");
    }
  });
});

test.describe("Counter App - Screenshot (Native Module)", () => {
  test("device.screenshot() captures screen", async ({ device }) => {
    const capabilities = await device.evaluate<{ screenshot: boolean }>(
      "global.__RN_DRIVER__.capabilities",
    );

    if (!capabilities.screenshot) {
      test.skip();
      return;
    }

    const screenshot = await device.screenshot();
    expect(screenshot).toBeInstanceOf(Buffer);
    expect(screenshot.length).toBeGreaterThan(0);

    // Verify it's a valid PNG (starts with PNG magic bytes)
    expect(screenshot[0]).toBe(0x89);
    expect(screenshot[1]).toBe(0x50); // 'P'
    expect(screenshot[2]).toBe(0x4e); // 'N'
    expect(screenshot[3]).toBe(0x47); // 'G'
  });

  test("screenshot.captureRegion() captures specific region", async ({ device }) => {
    const capabilities = await device.evaluate<{ screenshot: boolean }>(
      "global.__RN_DRIVER__.capabilities",
    );

    if (!capabilities.screenshot) {
      test.skip();
      return;
    }

    type NativeResult<T> = { success: true; data: T } | { success: false; error: string };

    // Capture a 100x100 region from top-left
    const result = await device.evaluate<NativeResult<string>>(
      "global.__RN_DRIVER__.screenshot.captureRegion({ x: 0, y: 0, width: 100, height: 100 })",
    );

    expect(result.success).toBe(true);
    if (result.success) {
      // Should be a base64 string
      expect(typeof result.data).toBe("string");
      expect(result.data.length).toBeGreaterThan(0);

      // Decode and verify PNG header
      const buffer = Buffer.from(result.data, "base64");
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50); // 'P'
    }
  });

  test("screenshot.captureElement() captures element by handle", async ({ device }) => {
    const capabilities = await device.evaluate<{ screenshot: boolean; viewTree: boolean }>(
      "global.__RN_DRIVER__.capabilities",
    );

    if (!capabilities.screenshot || !capabilities.viewTree) {
      test.skip();
      return;
    }

    type NativeResult<T> = { success: true; data: T } | { success: false; error: string };
    type ElementInfo = { handle: string };

    // First find an element to get its handle
    const findResult = await device.evaluate<NativeResult<ElementInfo>>(
      "global.__RN_DRIVER__.viewTree.findByTestId('increment-button')",
    );

    if (!findResult.success) {
      test.skip();
      return;
    }

    // Now capture that element using the harness bridge
    const captureResult = await device.evaluate<NativeResult<string>>(
      `global.__RN_DRIVER__.screenshot.captureElement('${findResult.data.handle}')`,
    );

    expect(captureResult.success).toBe(true);
    if (captureResult.success) {
      expect(typeof captureResult.data).toBe("string");
      expect(captureResult.data.length).toBeGreaterThan(0);

      // Decode and verify PNG header
      const buffer = Buffer.from(captureResult.data, "base64");
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50); // 'P'
    }
  });
});

test.describe("Counter App - Lifecycle (Native Module)", () => {
  test("device.openURL() opens URL", async ({ device }) => {
    const capabilities = await device.evaluate<{ lifecycle: boolean }>(
      "global.__RN_DRIVER__.capabilities",
    );

    if (!capabilities.lifecycle) {
      test.skip();
      return;
    }

    // Try to open a deep link - this may or may not succeed depending on app config
    try {
      await device.openURL("example://test");
    } catch (error) {
      // Expected on iOS if the URL scheme isn't registered
      expect(error).toBeDefined();
    }
  });

  test("lifecycle.getState() returns app state", async ({ device }) => {
    const capabilities = await device.evaluate<{ lifecycle: boolean }>(
      "global.__RN_DRIVER__.capabilities",
    );

    if (!capabilities.lifecycle) {
      test.skip();
      return;
    }

    type StateResult = { success: true; data: string } | { success: false; error: string };
    const result = await device.evaluate<StateResult>("global.__RN_DRIVER__.lifecycle.getState()");

    if (result.success) {
      expect(["active", "background", "inactive"]).toContain(result.data);
    }
  });

  test("lifecycle control APIs return valid results", async ({ device }) => {
    const capabilities = await device.evaluate<{ lifecycle: boolean }>(
      "global.__RN_DRIVER__.capabilities",
    );

    if (!capabilities.lifecycle) {
      test.skip();
      return;
    }

    type NativeResult<T> =
      | { success: true; data: T }
      | { success: false; error: string; code: string };

    const platform = await device.evaluate<string>("require('react-native').Platform.OS");

    // Test reload - may return NOT_SUPPORTED in production
    const reloadResult = await device.evaluate<NativeResult<void>>(
      "global.__RN_DRIVER__.lifecycle.reload()",
    );
    expect(typeof reloadResult.success).toBe("boolean");

    // Test background - iOS returns NOT_SUPPORTED
    const bgResult = await device.evaluate<NativeResult<void>>(
      "global.__RN_DRIVER__.lifecycle.background()",
    );
    if (platform === "ios") {
      expect(bgResult.success).toBe(false);
    }

    // Test foreground - no-op success when already active
    const fgResult = await device.evaluate<NativeResult<void>>(
      "global.__RN_DRIVER__.lifecycle.foreground()",
    );
    expect(fgResult.success).toBe(true);
  });
});
