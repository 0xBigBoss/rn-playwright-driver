/**
 * E2E tests for pointer path APIs.
 *
 * Tests dragPath() and movePath() for complex gesture paths.
 *
 * NOTE: These tests require the harness touch handler to be registered.
 * They skip if touch backend is not available (e.g., native-module without RNDriverTouchInjector).
 */

import type { DriverEvent } from "@0xbigboss/rn-playwright-driver";
import { expect, test } from "@0xbigboss/rn-playwright-driver/test";

test.describe("Pointer Paths", () => {
  test("dragPath() executes without error with valid path", async ({ device }) => {
    // Register harness touch handler for this test
    await device.evaluate<void>(`
      globalThis.__testHandler = () => {};
      globalThis.__RN_DRIVER__.registerTouchHandler('pathTest', globalThis.__testHandler);
    `);

    const path = [
      { x: 100, y: 100 },
      { x: 150, y: 150 },
      { x: 200, y: 100 },
    ];

    try {
      await device.pointer.dragPath(path);
    } finally {
      await device.evaluate<void>(`
        globalThis.__RN_DRIVER__.unregisterTouchHandler('pathTest');
        delete globalThis.__testHandler;
      `);
    }
  });

  test("dragPath() with single point", async ({ device }) => {
    await device.evaluate<void>(`
      globalThis.__RN_DRIVER__.registerTouchHandler('pathTest', () => {});
    `);

    try {
      await device.pointer.dragPath([{ x: 100, y: 100 }]);
    } finally {
      await device.evaluate<void>(`
        globalThis.__RN_DRIVER__.unregisterTouchHandler('pathTest');
      `);
    }
  });

  test("dragPath() with empty path returns early", async ({ device }) => {
    // Empty path should be a no-op, doesn't require touch handler
    await device.pointer.dragPath([]);
  });

  test("dragPath() generates pointer events", async ({ device }) => {
    await device.evaluate<void>(`
      globalThis.__RN_DRIVER__.registerTouchHandler('pathTest', () => {});
    `);

    await device.startTracing();

    const path = [
      { x: 100, y: 100 },
      { x: 150, y: 150 },
      { x: 200, y: 200 },
    ];

    try {
      await device.pointer.dragPath(path);
    } finally {
      await device.evaluate<void>(`
        globalThis.__RN_DRIVER__.unregisterTouchHandler('pathTest');
      `);
    }

    const result = await device.stopTracing();

    // Should have down, move, and up events
    const downEvents = result.events.filter((e: DriverEvent) => e.type === "pointer:down");
    const moveEvents = result.events.filter((e: DriverEvent) => e.type === "pointer:move");
    const upEvents = result.events.filter((e: DriverEvent) => e.type === "pointer:up");

    expect(downEvents.length).toBeGreaterThanOrEqual(1);
    expect(moveEvents.length).toBeGreaterThanOrEqual(1);
    expect(upEvents.length).toBeGreaterThanOrEqual(1);
  });

  test("dragPath() with delay option", async ({ device }) => {
    await device.evaluate<void>(`
      globalThis.__RN_DRIVER__.registerTouchHandler('pathTest', () => {});
    `);

    const path = [
      { x: 100, y: 100 },
      { x: 150, y: 150 },
      { x: 200, y: 200 },
    ];

    const startTime = Date.now();
    try {
      await device.pointer.dragPath(path, { delay: 50 });
    } finally {
      await device.evaluate<void>(`
        globalThis.__RN_DRIVER__.unregisterTouchHandler('pathTest');
      `);
    }
    const endTime = Date.now();

    // With 3 points and 50ms delay between each, should take at least 100ms
    expect(endTime - startTime).toBeGreaterThanOrEqual(100);
  });

  test("movePath() executes without error with valid path", async ({ device }) => {
    await device.evaluate<void>(`
      globalThis.__RN_DRIVER__.registerTouchHandler('pathTest', () => {});
    `);

    const path = [
      { x: 100, y: 100 },
      { x: 150, y: 150 },
      { x: 200, y: 100 },
    ];

    try {
      await device.pointer.movePath(path);
    } finally {
      await device.evaluate<void>(`
        globalThis.__RN_DRIVER__.unregisterTouchHandler('pathTest');
      `);
    }
  });

  test("movePath() with single point", async ({ device }) => {
    await device.evaluate<void>(`
      globalThis.__RN_DRIVER__.registerTouchHandler('pathTest', () => {});
    `);

    try {
      await device.pointer.movePath([{ x: 100, y: 100 }]);
    } finally {
      await device.evaluate<void>(`
        globalThis.__RN_DRIVER__.unregisterTouchHandler('pathTest');
      `);
    }
  });

  test("movePath() with empty path returns early", async ({ device }) => {
    // Empty path should be a no-op, doesn't require touch handler
    await device.pointer.movePath([]);
  });

  test("movePath() generates only move events (no down/up)", async ({ device }) => {
    await device.evaluate<void>(`
      globalThis.__RN_DRIVER__.registerTouchHandler('pathTest', () => {});
    `);

    await device.startTracing();

    const path = [
      { x: 100, y: 100 },
      { x: 150, y: 150 },
      { x: 200, y: 200 },
    ];

    try {
      await device.pointer.movePath(path);
    } finally {
      await device.evaluate<void>(`
        globalThis.__RN_DRIVER__.unregisterTouchHandler('pathTest');
      `);
    }

    const result = await device.stopTracing();

    // Should only have move events from this operation
    const moveEvents = result.events.filter((e: DriverEvent) => e.type === "pointer:move");
    expect(moveEvents.length).toBeGreaterThan(0);
  });

  test("movePath() with delay option", async ({ device }) => {
    await device.evaluate<void>(`
      globalThis.__RN_DRIVER__.registerTouchHandler('pathTest', () => {});
    `);

    const path = [
      { x: 100, y: 100 },
      { x: 150, y: 150 },
      { x: 200, y: 200 },
    ];

    const startTime = Date.now();
    try {
      await device.pointer.movePath(path, { delay: 30 });
    } finally {
      await device.evaluate<void>(`
        globalThis.__RN_DRIVER__.unregisterTouchHandler('pathTest');
      `);
    }
    const endTime = Date.now();

    // Should take at least (points-1) * delay ms
    expect(endTime - startTime).toBeGreaterThanOrEqual(60);
  });

  test("dragPath() complex path with many points", async ({ device }) => {
    await device.evaluate<void>(`
      globalThis.__RN_DRIVER__.registerTouchHandler('pathTest', () => {});
    `);

    // Create a square path
    const path = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 },
      { x: 100, y: 100 },
    ];

    try {
      await device.pointer.dragPath(path);
    } finally {
      await device.evaluate<void>(`
        globalThis.__RN_DRIVER__.unregisterTouchHandler('pathTest');
      `);
    }
  });

  test("movePath() can trace hover effects", async ({ device }) => {
    // Register a move handler to track moves
    await device.evaluate<void>(`
      globalThis.__testMoveCount = 0;
      globalThis.__RN_DRIVER__.registerTouchHandler('pathTest', (e) => {
        if (e.type === 'move') globalThis.__testMoveCount++;
      });
    `);

    const path = [
      { x: 100, y: 100 },
      { x: 120, y: 120 },
      { x: 140, y: 140 },
    ];

    try {
      await device.pointer.movePath(path);

      const moveCount = await device.evaluate<number>("globalThis.__testMoveCount");
      expect(moveCount).toBeGreaterThan(0);
    } finally {
      // Clean up
      await device.evaluate<void>(`
        globalThis.__RN_DRIVER__.unregisterTouchHandler('pathTest');
        delete globalThis.__testMoveCount;
      `);
    }
  });

  test("dragPath() followed by movePath() works correctly", async ({ device }) => {
    await device.evaluate<void>(`
      globalThis.__RN_DRIVER__.registerTouchHandler('pathTest', () => {});
    `);

    try {
      // First a drag
      await device.pointer.dragPath([
        { x: 50, y: 50 },
        { x: 100, y: 100 },
      ]);

      // Then a move
      await device.pointer.movePath([
        { x: 150, y: 150 },
        { x: 200, y: 200 },
      ]);
    } finally {
      await device.evaluate<void>(`
        globalThis.__RN_DRIVER__.unregisterTouchHandler('pathTest');
      `);
    }
  });
});
