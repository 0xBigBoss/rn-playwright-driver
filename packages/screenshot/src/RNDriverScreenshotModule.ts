import { requireNativeModule } from "expo-modules-core";

import type { ElementBounds, NativeResult } from "./types";

/**
 * Native module interface for screenshots.
 */
interface ScreenshotModuleInterface {
	captureScreen(): Promise<NativeResult<string>>;
	captureElement(handle: string): Promise<NativeResult<string>>;
	captureRegion(
		x: number,
		y: number,
		width: number,
		height: number,
	): Promise<NativeResult<string>>;
}

const NativeModule =
	requireNativeModule<ScreenshotModuleInterface>("RNDriverScreenshot");

/**
 * Screenshot module for capturing screen and element screenshots.
 *
 * Note: captureElement is only supported via the harness bridge
 * (global.__RN_DRIVER__.screenshot.captureElement). Direct calls
 * to this module's captureElement will return NOT_SUPPORTED.
 * The harness orchestrates viewTree.getBounds + screenshot.captureRegion
 * to implement element capture without cross-module handle sharing.
 */
export const RNDriverScreenshotModule = {
	/**
	 * Capture full screen screenshot.
	 * Returns base64-encoded PNG.
	 */
	captureScreen(): Promise<NativeResult<string>> {
		return NativeModule.captureScreen();
	},

	/**
	 * Capture screenshot of specific element.
	 * Returns base64-encoded PNG cropped to element bounds.
	 *
	 * Note: This method returns NOT_SUPPORTED when called directly.
	 * Use the harness bridge instead: global.__RN_DRIVER__.screenshot.captureElement(handle)
	 * The harness orchestrates viewTree.getBounds + captureRegion to implement this.
	 */
	captureElement(handle: string): Promise<NativeResult<string>> {
		return NativeModule.captureElement(handle);
	},

	/**
	 * Capture screenshot of specific region.
	 * Bounds are in logical points.
	 */
	captureRegion(bounds: ElementBounds): Promise<NativeResult<string>> {
		return NativeModule.captureRegion(
			bounds.x,
			bounds.y,
			bounds.width,
			bounds.height,
		);
	},
};
