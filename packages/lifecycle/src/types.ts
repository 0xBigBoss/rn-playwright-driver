/**
 * App lifecycle states.
 */
export type AppState = "active" | "background" | "inactive";

/**
 * Error codes for native module calls.
 */
export type ErrorCode = "INTERNAL" | "NOT_SUPPORTED" | "INVALID_URL";

/**
 * Standard result wrapper for native module calls.
 */
export type NativeResult<T> =
	| { success: true; data: T }
	| { success: false; error: string; code: ErrorCode };
