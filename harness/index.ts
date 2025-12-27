/**
 * RN Driver Harness - Install in your React Native app
 *
 * Usage:
 *   import '@0xbigboss/rn-playwright-driver/harness';
 *
 * This creates global.__RN_DRIVER__ with pointer simulation and
 * framework adapter registration.
 */

/**
 * Touch event data passed to handlers.
 */
export type TouchEvent = {
  /** X position in logical points */
  x: number;
  /** Y position in logical points */
  y: number;
  /** Event type */
  type: "down" | "move" | "up";
  /** Timestamp when event was created */
  timestamp: number;
};

/**
 * Touch handler function type.
 */
export type TouchHandler = (event: TouchEvent) => void;

/**
 * Global driver interface exposed on global.__RN_DRIVER__.
 */
export type RNDriverGlobal = {
  /** Version of the harness */
  version: string;

  /** Pointer/touch simulation */
  pointer: {
    tap: (x: number, y: number) => void;
    down: (x: number, y: number) => void;
    move: (x: number, y: number) => void;
    up: () => void;
  };

  /**
   * Register a touch handler for a framework adapter.
   * Key is used to allow HMR updates (re-registration with same key replaces).
   */
  registerTouchHandler: (key: string, handler: TouchHandler) => void;

  /**
   * Unregister a touch handler.
   */
  unregisterTouchHandler: (key: string) => void;

  /** Internal state (for debugging) */
  _internal: {
    handlers: Map<string, TouchHandler>;
    lastPosition: { x: number; y: number } | null;
    isDown: boolean;
  };
};

// Extend global type
declare global {
  // eslint-disable-next-line no-var
  var __RN_DRIVER__: RNDriverGlobal | undefined;
}

/**
 * Create and install the driver harness.
 */
function installHarness(): void {
  // Don't reinstall if already present (allows HMR)
  if (global.__RN_DRIVER__) {
    return;
  }

  const handlers = new Map<string, TouchHandler>();
  let lastPosition: { x: number; y: number } | null = null;
  let isDown = false;

  /**
   * Dispatch a touch event to all registered handlers.
   */
  function dispatchTouch(event: TouchEvent): void {
    for (const handler of handlers.values()) {
      try {
        handler(event);
      } catch (error) {
        console.error("[RN_DRIVER] Handler error:", error);
      }
    }
  }

  const harness: RNDriverGlobal = {
    version: "0.1.0",

    pointer: {
      tap(x: number, y: number): void {
        harness.pointer.down(x, y);
        harness.pointer.up();
      },

      down(x: number, y: number): void {
        lastPosition = { x, y };
        isDown = true;

        dispatchTouch({
          x,
          y,
          type: "down",
          timestamp: Date.now(),
        });
      },

      move(x: number, y: number): void {
        lastPosition = { x, y };

        dispatchTouch({
          x,
          y,
          type: "move",
          timestamp: Date.now(),
        });
      },

      up(): void {
        const position = lastPosition ?? { x: 0, y: 0 };
        isDown = false;

        dispatchTouch({
          x: position.x,
          y: position.y,
          type: "up",
          timestamp: Date.now(),
        });
      },
    },

    registerTouchHandler(key: string, handler: TouchHandler): void {
      handlers.set(key, handler);
    },

    unregisterTouchHandler(key: string): void {
      handlers.delete(key);
    },

    _internal: {
      handlers,
      get lastPosition() {
        return lastPosition;
      },
      get isDown() {
        return isDown;
      },
    },
  };

  global.__RN_DRIVER__ = harness;

  if (__DEV__) {
    console.log("[RN_DRIVER] Harness installed");
  }
}

// Declare __DEV__ for RN environment
declare const __DEV__: boolean | undefined;

// Install immediately on import
installHarness();
