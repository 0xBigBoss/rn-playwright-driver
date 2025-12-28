import WebSocket from "ws";

export type CDPClientOptions = {
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  // TODO (Phase 4): Add autoReconnect option when implemented
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

/**
 * CDP protocol result type - intentionally loose as CDP responses vary by method.
 */
type CDPResult = {
  result?: { value?: unknown };
  exceptionDetails?: {
    text?: string;
    exception?: { description?: string };
  };
  [key: string]: unknown;
};

/**
 * Chrome DevTools Protocol client for Hermes runtime.
 */
export class CDPClient {
  private ws: WebSocket | null = null;
  private messageId = 0;
  private pending = new Map<number, PendingRequest>();
  private options: Required<CDPClientOptions>;

  constructor(options: CDPClientOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30_000,
    };
  }

  async connect(wsUrl: string): Promise<void> {
    this.ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        this.ws?.removeListener("open", onOpen);
        this.ws?.removeListener("error", onError);
      };
      this.ws!.on("open", onOpen);
      this.ws!.on("error", onError);
    });

    this.ws.on("message", this.handleMessage.bind(this));
    this.ws.on("close", this.handleClose.bind(this));
    this.ws.on("error", this.handleError.bind(this));

    await this.send("Runtime.enable", {});
  }

  async disconnect(): Promise<void> {
    // Reject all pending requests
    for (const [, { reject, timer }] of this.pending) {
      clearTimeout(timer);
      reject(new Error("CDP client disconnected"));
    }
    this.pending.clear();

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
  }

  /** Health check - validates connection is alive */
  async ping(): Promise<boolean> {
    try {
      await this.send("Runtime.evaluate", { expression: "1", returnByValue: true });
      return true;
    } catch {
      return false;
    }
  }

  async evaluate<T>(expression: string): Promise<T> {
    const resultId = `__CDP_RESULT_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const wrappedExpression = `
      (function() {
        try {
          const value = (${expression});
          if (value && typeof value.then === 'function') {
            const id = '${resultId}';
            globalThis[id] = { pending: true };
            value.then(
              function(v) {
                const hasValue = typeof v !== 'undefined';
                globalThis[id] = { done: true, hasValue: hasValue, value: v };
              },
              function(e) {
                globalThis[id] = { done: true, error: e && e.message ? e.message : String(e) };
              }
            );
            return { async: true, id: id };
          }
          const hasValue = typeof value !== 'undefined';
          return { async: false, hasValue: hasValue, value: value };
        } catch (e) {
          return { async: false, error: e && e.message ? e.message : String(e) };
        }
      })()
    `;

    const result = await this.send("Runtime.evaluate", {
      expression: wrappedExpression,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      const text =
        result.exceptionDetails.text ??
        result.exceptionDetails.exception?.description ??
        "Unknown error";
      throw new Error(`CDP evaluate failed: ${text}`);
    }

    type EvaluatePayload =
      | { async: true; id: string }
      | { async: false; hasValue: boolean; value?: T }
      | { async: false; error: string };

    const payload = result.result?.value as EvaluatePayload | undefined;
    if (!payload) {
      throw new Error("CDP evaluate failed: empty result");
    }

    if ("error" in payload) {
      throw new Error(`CDP evaluate failed: ${payload.error}`);
    }

    if (payload.async) {
      return this.pollForResult<T>(payload.id);
    }

    return (payload.hasValue ? payload.value : undefined) as T;
  }

  /**
   * Poll for a result stored in globalThis by evaluate().
   */
  private async pollForResult<T>(resultId: string): Promise<T> {
    const startTime = Date.now();
    const timeout = this.options.timeout;

    while (Date.now() - startTime < timeout) {
      const checkExpr = `
        (function() {
          const r = globalThis['${resultId}'];
          if (r && r.done) {
            delete globalThis['${resultId}'];
            return r;
          }
          return { pending: true };
        })()
      `;

      const checkResult = await this.send("Runtime.evaluate", {
        expression: checkExpr,
        returnByValue: true,
      });

      if (checkResult.exceptionDetails) {
        const text =
          checkResult.exceptionDetails.text ??
          checkResult.exceptionDetails.exception?.description ??
          "Unknown error";
        throw new Error(`CDP evaluate failed: ${text}`);
      }

      const status = checkResult.result?.value as
        | { pending: true }
        | { done: true; hasValue: boolean; value?: T }
        | { done: true; error: string };

      if (status && "done" in status && status.done) {
        if ("error" in status) {
          throw new Error(`CDP evaluate failed: ${status.error}`);
        }
        return (status.hasValue ? status.value : undefined) as T;
      }

      // Wait a bit before polling again
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Cleanup and throw timeout
    await this.send("Runtime.evaluate", {
      expression: `delete globalThis['${resultId}']`,
      returnByValue: true,
    });
    throw new Error(`CDP evaluate timed out after ${timeout}ms`);
  }

  private async send(method: string, params: object): Promise<CDPResult> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("CDP client not connected");
    }

    const id = ++this.messageId;

    return new Promise<CDPResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP request timed out after ${this.options.timeout}ms: ${method}`));
      }, this.options.timeout);

      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      this.ws!.send(JSON.stringify({ id, method, params }));
    });
  }

  private handleMessage(data: Buffer) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(data.toString()) as Record<string, unknown>;
    } catch (err) {
      console.error("CDP: Failed to parse message:", err);
      return;
    }

    const id = msg.id as number | undefined;
    if (id !== undefined && this.pending.has(id)) {
      const { resolve, reject, timer } = this.pending.get(id)!;
      clearTimeout(timer);
      this.pending.delete(id);

      // msg.error indicates CDP protocol error (distinct from JS exception)
      const error = msg.error as { message?: string } | undefined;
      if (error) {
        reject(new Error(`CDP error: ${error.message ?? JSON.stringify(error)}`));
      } else {
        resolve(msg.result);
      }
    }
    // TODO: Handle CDP events (msg.method) for console, exceptions, etc.
  }

  private handleClose(code: number, reason: Buffer) {
    // Reject all pending requests
    const error = new Error(`CDP connection closed: ${code} ${reason.toString()}`);
    for (const [, { reject, timer }] of this.pending) {
      clearTimeout(timer);
      reject(error);
    }
    this.pending.clear();

    // TODO (Phase 4): Implement autoReconnect if enabled
  }

  private handleError(err: Error) {
    console.error("CDP WebSocket error:", err);
  }
}
