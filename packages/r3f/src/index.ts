// @0xbigboss/rn-driver-r3f - R3F integration for rn-playwright-driver

// --- Components ---
export { TestBridge } from "./TestBridge";
export type { TestBridgeProps } from "./TestBridge";

export { R3FTouchAdapter } from "./R3FTouchAdapter";
export type { R3FTouchAdapterProps } from "./R3FTouchAdapter";

// --- Types ---
export type {
  R3FBridgeCapabilities,
  R3FDriverBridge,
  R3FHitResult,
  R3FObjectInfo,
  R3FScreenBounds,
  R3FScreenPosition,
} from "./types";

// --- Helpers ---
export { getR3FObjectPosition, tapR3FObject, verifyHitTarget } from "./helpers";
export type { LookupMethod, R3FLookupOptions } from "./helpers";
