/**
 * R3F Test Helpers - Convenience functions for testing R3F scenes
 *
 * @example
 * ```typescript
 * import { tapR3FObject, getR3FObjectPosition } from '@0xbigboss/rn-driver-r3f/helpers';
 *
 * test('tap object by testId', async ({ device }) => {
 *   await tapR3FObject(device, 'my-block-id');
 * });
 * ```
 */
import type { Device } from "@0xbigboss/rn-playwright-driver";
import type { R3FHitResult, R3FScreenPosition } from "./types";

/**
 * How to look up an R3F object.
 */
export type LookupMethod = "name" | "uuid" | "testId";

/**
 * Options for R3F object lookup.
 */
export type R3FLookupOptions = {
  /** How to look up the object: 'name', 'uuid', or 'testId' (default) */
  method?: LookupMethod;
  /** Canvas ID for multi-canvas support */
  canvasId?: string;
};

/**
 * Get screen position for an R3F object.
 *
 * @param device - The test device
 * @param identifier - The object identifier (name, uuid, or testId)
 * @param options - Lookup options
 * @returns Screen position with visibility info
 * @throws Error if object not found, off-screen, or outside frustum
 */
export async function getR3FObjectPosition(
  device: Device,
  identifier: string,
  options?: R3FLookupOptions,
): Promise<R3FScreenPosition> {
  const { method = "testId", canvasId } = options ?? {};
  const bridge = canvasId
    ? `globalThis.__RN_DRIVER_R3F_REGISTRY__['${canvasId}']`
    : "globalThis.__RN_DRIVER_R3F__";

  const methodName =
    method === "uuid"
      ? "getObjectScreenPositionByUuid"
      : method === "testId"
        ? "getObjectScreenPositionByTestId"
        : "getObjectScreenPosition";

  const pos = await device.evaluate<R3FScreenPosition | null>(
    `${bridge}?.${methodName}(${JSON.stringify(identifier)})`,
  );

  if (!pos) {
    throw new Error(`R3F object not found (${method}): ${identifier}`);
  }
  if (!pos.isOnScreen) {
    throw new Error(`R3F object is off-screen: ${identifier}`);
  }
  if (!pos.isInFrustum) {
    throw new Error(`R3F object is outside camera frustum: ${identifier}`);
  }

  return pos;
}

/**
 * Tap an R3F object by testId (default) or other identifier.
 *
 * @param device - The test device
 * @param identifier - The object identifier (name, uuid, or testId)
 * @param options - Lookup options
 */
export async function tapR3FObject(
  device: Device,
  identifier: string,
  options?: R3FLookupOptions,
): Promise<void> {
  const pos = await getR3FObjectPosition(device, identifier, options);
  await device.pointer.tap(pos.x, pos.y);
}

/**
 * Verify that hitting a screen position returns the expected object.
 *
 * @param device - The test device
 * @param x - Screen X coordinate
 * @param y - Screen Y coordinate
 * @param expectedTestId - Expected testId of the hit object
 * @param canvasId - Optional canvas ID for multi-canvas support
 * @returns The hit result
 * @throws Error if no hit or unexpected object hit
 */
export async function verifyHitTarget(
  device: Device,
  x: number,
  y: number,
  expectedTestId: string,
  canvasId?: string,
): Promise<R3FHitResult> {
  const bridge = canvasId
    ? `globalThis.__RN_DRIVER_R3F_REGISTRY__['${canvasId}']`
    : "globalThis.__RN_DRIVER_R3F__";

  const hit = await device.evaluate<R3FHitResult | null>(`${bridge}?.hitTest(${x}, ${y})`);

  if (!hit) {
    throw new Error(`No hit at (${x}, ${y})`);
  }
  if (hit.testId !== expectedTestId) {
    throw new Error(
      `Expected to hit testId='${expectedTestId}' but hit '${hit.name}' (testId: ${hit.testId})`,
    );
  }

  return hit;
}
