export class CdpConnection {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener("message", (event) => this.#onMessage(event));
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", () => reject(new Error(`Could not connect to ${this.url}`)), { once: true });
    });
    return this;
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timed out: ${method}`));
      }, 10_000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || new Set();
    listeners.add(listener);
    this.listeners.set(method, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(method);
    };
  }

  close() {
    this.socket?.close();
  }

  #onMessage(event) {
    const message = JSON.parse(String(event.data));
    if (message.method) {
      for (const listener of this.listeners.get(message.method) || []) {
        try { Promise.resolve(listener(message.params || {})).catch(() => {}); } catch {}
      }
      return;
    }
    if (!message.id || !this.pending.has(message.id)) return;
    const pending = this.pending.get(message.id);
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) pending.reject(new Error(message.error.message));
    else pending.resolve(message.result);
  }
}

export async function injectTarget(target, expression, prepare) {
  const connection = await new CdpConnection(target.webSocketDebuggerUrl).connect();
  try {
    await prepare?.(connection);
    await replaceInjection(connection, expression);
    return connection;
  } catch (error) {
    connection.close();
    throw error;
  }
}

export async function replaceInjection(connection, expression) {
  const previousIdentifier = connection.bettercodexScriptIdentifier;
  const registration = await connection.send("Page.addScriptToEvaluateOnNewDocument", { source: expression });
  try {
    const result = await connection.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Renderer rejected BetterCodex");
    connection.bettercodexScriptIdentifier = registration.identifier;
    if (previousIdentifier) {
      await connection.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: previousIdentifier });
    }
    return true;
  } catch (error) {
    if (registration.identifier) {
      await connection.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: registration.identifier }).catch(() => {});
    }
    throw error;
  }
}
