/**
 * E2E tests for gesture and pointer interactions.
 *
 * Tests swipe, drag, tap, and other pointer operations.
 *
 * NOTE: These tests require:
 * 1. The RN app running with Metro (bun start)
 * 2. A device connected with Hermes debugging enabled
 * 3. Native modules installed (view-tree, screenshot, lifecycle)
 */

import { expect, expectLocator, test } from "@0xbigboss/rn-playwright-driver/test";

test.describe("Gesture Interactions", () => {
  test("swipe performs smooth gesture", async ({ device }) => {
    // Get screen dimensions from an element
    const counter = device.getByTestId("count-display");
    const bounds = await counter.bounds();
    expect(bounds).not.toBeNull();

    // Perform a vertical swipe
    const startY = bounds!.y + 100;
    const endY = bounds!.y + 300;
    const centerX = bounds!.x + bounds!.width / 2;

    await device.pointer.swipe({
      from: { x: centerX, y: startY },
      to: { x: centerX, y: endY },
      duration: 300,
    });

    // Swipe completed without error
  });

  test("swipe with custom duration", async ({ device }) => {
    const counter = device.getByTestId("count-display");
    const bounds = await counter.bounds();
    expect(bounds).not.toBeNull();

    const centerX = bounds!.x + bounds!.width / 2;
    const centerY = bounds!.y + bounds!.height / 2;

    // Fast swipe
    await device.pointer.swipe({
      from: { x: centerX, y: centerY },
      to: { x: centerX + 100, y: centerY },
      duration: 100,
    });

    // Slow swipe
    await device.pointer.swipe({
      from: { x: centerX + 100, y: centerY },
      to: { x: centerX, y: centerY },
      duration: 500,
    });
  });

  test("drag performs interpolated movement", async ({ device }) => {
    const counter = device.getByTestId("count-display");
    const bounds = await counter.bounds();
    expect(bounds).not.toBeNull();

    const startX = bounds!.x;
    const startY = bounds!.y;

    await device.pointer.drag(
      { x: startX, y: startY },
      { x: startX + 50, y: startY + 50 },
      { steps: 5 },
    );
  });

  test("tap on element center", async ({ device }) => {
    const button = device.getByTestId("increment-button");
    await expectLocator(button).toBeVisible();

    // Tap the button
    await button.tap();

    // Verify the tap was registered by checking counter value changed
    // (Actual verification depends on app state)
  });

  test("pointer down/move/up sequence", async ({ device }) => {
    const counter = device.getByTestId("count-display");
    const bounds = await counter.bounds();
    expect(bounds).not.toBeNull();

    const x = bounds!.x + bounds!.width / 2;
    const y = bounds!.y + bounds!.height / 2;

    // Manual gesture sequence
    await device.pointer.down(x, y);
    await device.pointer.move(x + 10, y);
    await device.pointer.move(x + 20, y);
    await device.pointer.up();
  });

  test("multiple taps in sequence", async ({ device }) => {
    const incrementButton = device.getByTestId("increment-button");
    await expectLocator(incrementButton).toBeVisible();

    // Tap multiple times
    await incrementButton.tap();
    await device.waitForTimeout(100);
    await incrementButton.tap();
    await device.waitForTimeout(100);
    await incrementButton.tap();
  });
});
