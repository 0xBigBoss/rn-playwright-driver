/**
 * Bounding rectangle in logical points.
 */
export type ElementBounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

/**
 * Error codes for native module calls.
 */
export type ErrorCode = "NOT_FOUND" | "INTERNAL" | "NOT_SUPPORTED";

/**
 * Standard result wrapper for native module calls.
 */
export type NativeResult<T> =
	| { success: true; data: T }
	| { success: false; error: string; code: ErrorCode };
