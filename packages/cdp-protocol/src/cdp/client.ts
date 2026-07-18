type CommandHandler = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

type EventHandler = (params: unknown) => void;

export class CDPClient {
  readonly ws: WebSocket;
  private pendingCommands = new Map<number, CommandHandler>();
  private eventHandlers = new Map<string, Set<EventHandler>>();
  private commandId = 1;

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
    this.ws.addEventListener("message", this.handleMessage.bind(this));
  }

  get readyState(): number {
    return this.ws.readyState;
  }

  waitForOpen(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.ws.addEventListener("open", () => resolve(), { once: true });
      this.ws.addEventListener("error", () => reject(new Error("WebSocket error")), { once: true });
    });
  }

  send<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string,
  ): Promise<T> {
    const id = this.commandId++;
    return new Promise<T>((resolve, reject) => {
      this.pendingCommands.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  on(event: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler); // safe: we just set it
    return () => this.eventHandlers.get(event)?.delete(handler);
  }

  private handleMessage(event: MessageEvent) {
    const msg = JSON.parse(event.data) as {
      id?: number;
      result?: unknown;
      error?: { message: string; code: number };
      method?: string;
      params?: unknown;
    };

    if (msg.id !== undefined) {
      const pending = this.pendingCommands.get(msg.id);
      if (pending) {
        if (msg.error) {
          pending.reject(new Error(msg.error.message));
        } else {
          pending.resolve(msg.result);
        }
        this.pendingCommands.delete(msg.id);
      }
    } else if (msg.method) {
      this.eventHandlers.get(msg.method)?.forEach((h) => h(msg.params));
    }
  }

  close() {
    this.ws.close();
  }
}
