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
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      const text =
        result.exceptionDetails.text ??
        result.exceptionDetails.exception?.description ??
        "Unknown error";
      throw new Error(`CDP evaluate failed: ${text}`);
    }
    return result.result?.value as T;
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
