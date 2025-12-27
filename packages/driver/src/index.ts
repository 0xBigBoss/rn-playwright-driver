// Main entry point for @0xbigboss/rn-playwright-driver

export type { CDPClientOptions } from "./cdp/client";
// --- CDP (advanced usage) ---
export { CDPClient } from "./cdp/client";
export type { DebugTarget, TargetSelectionOptions } from "./cdp/discovery";
export { discoverTargets, selectTarget } from "./cdp/discovery";
export type { RNDeviceOptions } from "./device";
// --- Device ---
export { createDevice, RNDevice, TimeoutError } from "./device";
export type { Locator as LocatorType, LocatorSelector } from "./locator";
// --- Locator ---
export { createLocator, LocatorError, LocatorImpl } from "./locator";
// --- Pointer ---
export { HarnessNotInstalledError, Pointer } from "./pointer";
// --- Types ---
export type { Device, DeviceOptions, ElementBounds, Locator, PointerOptions } from "./types";
