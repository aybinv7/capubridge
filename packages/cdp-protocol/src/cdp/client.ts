type CommandHandler = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type EventHandler = (params: unknown) => void;

export interface CDPClientOptions {
  commandTimeoutMs?: number;
}

export interface CDPCommandOptions {
  timeoutMs?: number;
}

export class CDPConnectionError extends Error {
  override readonly name: string = "CDPConnectionError";
}

export class CDPConnectionClosedError extends CDPConnectionError {
  override readonly name: string = "CDPConnectionClosedError";
}

export class CDPCommandTimeoutError extends Error {
  readonly name = "CDPCommandTimeoutError";

  constructor(
    readonly method: string,
    readonly timeoutMs: number,
  ) {
    super(`CDP command ${method} timed out after ${timeoutMs} ms`);
  }
}

export class CDPProtocolError extends Error {
  readonly name = "CDPProtocolError";

  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message);
  }
}

const DEFAULT_COMMAND_TIMEOUT_MS = 30_000;

export class CDPClient {
  readonly ws: WebSocket;
  private pendingCommands = new Map<number, CommandHandler>();
  private eventHandlers = new Map<string, Set<EventHandler>>();
  private commandId = 1;
  private readonly commandTimeoutMs: number;

  constructor(wsUrl: string, options: CDPClientOptions = {}) {
    this.commandTimeoutMs = options.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
    if (!Number.isFinite(this.commandTimeoutMs) || this.commandTimeoutMs <= 0) {
      throw new RangeError("commandTimeoutMs must be a positive finite number");
    }
    this.ws = new WebSocket(wsUrl);
    this.ws.addEventListener("message", this.handleMessage);
    this.ws.addEventListener("close", this.handleClose);
    this.ws.addEventListener("error", this.handleError);
  }

  get readyState(): number {
    return this.ws.readyState;
  }

  waitForOpen(timeoutMs = this.commandTimeoutMs): Promise<void> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return Promise.reject(new RangeError("timeoutMs must be a positive finite number"));
    }
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.ws.readyState === WebSocket.CLOSING || this.ws.readyState === WebSocket.CLOSED) {
      return Promise.reject(new CDPConnectionClosedError("CDP connection closed before opening"));
    }
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        this.ws.removeEventListener("open", handleOpen);
        this.ws.removeEventListener("error", handleError);
        this.ws.removeEventListener("close", handleClose);
      };
      const handleOpen = () => {
        cleanup();
        resolve();
      };
      const handleError = () => {
        cleanup();
        reject(new CDPConnectionError("CDP connection failed before opening"));
      };
      const handleClose = () => {
        cleanup();
        reject(new CDPConnectionClosedError("CDP connection closed before opening"));
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new CDPCommandTimeoutError("WebSocket.open", timeoutMs));
      }, timeoutMs);
      this.ws.addEventListener("open", handleOpen, { once: true });
      this.ws.addEventListener("error", handleError, { once: true });
      this.ws.addEventListener("close", handleClose, { once: true });
    });
  }

  send<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string,
    options: CDPCommandOptions = {},
  ): Promise<T> {
    if (this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new CDPConnectionClosedError("CDP connection is not open"));
    }
    const timeoutMs = options.timeoutMs ?? this.commandTimeoutMs;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return Promise.reject(new RangeError("timeoutMs must be a positive finite number"));
    }
    const id = this.commandId++;
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.pendingCommands.delete(id)) return;
        reject(new CDPCommandTimeoutError(method, timeoutMs));
      }, timeoutMs);
      this.pendingCommands.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });
      try {
        this.ws.send(JSON.stringify({ id, method, params, sessionId }));
      } catch (error) {
        this.settleCommand(id, "reject", error);
      }
    });
  }

  on(event: string, handler: EventHandler): () => void {
    let handlers = this.eventHandlers.get(event);
    if (!handlers) {
      handlers = new Set();
      this.eventHandlers.set(event, handlers);
    }
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) this.eventHandlers.delete(event);
    };
  }

  private settleCommand(id: number, action: "resolve" | "reject", value: unknown) {
    const pending = this.pendingCommands.get(id);
    if (!pending) return;
    this.pendingCommands.delete(id);
    clearTimeout(pending.timeout);
    pending[action](value);
  }

  private rejectPending(error: Error) {
    const ids = [...this.pendingCommands.keys()];
    for (const id of ids) this.settleCommand(id, "reject", error);
  }

  private handleMessage = (event: MessageEvent) => {
    const msg = JSON.parse(String(event.data)) as {
      id?: number;
      result?: unknown;
      error?: { message: string; code: number };
      method?: string;
      params?: unknown;
    };

    if (msg.id !== undefined) {
      if (msg.error) {
        this.settleCommand(
          msg.id,
          "reject",
          new CDPProtocolError(msg.error.message, msg.error.code),
        );
      } else {
        this.settleCommand(msg.id, "resolve", msg.result);
      }
    } else if (msg.method) {
      this.eventHandlers.get(msg.method)?.forEach((h) => h(msg.params));
    }
  };

  private handleClose = () => {
    this.rejectPending(new CDPConnectionClosedError("CDP connection closed"));
    this.eventHandlers.clear();
  };

  private handleError = () => {
    this.rejectPending(new CDPConnectionError("CDP connection failed"));
    this.eventHandlers.clear();
    if (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  };

  close() {
    this.rejectPending(new CDPConnectionClosedError("CDP connection closed by client"));
    this.eventHandlers.clear();
    if (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}
