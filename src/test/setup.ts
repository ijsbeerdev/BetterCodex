import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";

const mockSockets: MockWebSocket[] = [];

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  constructor(url: string | URL) {
    this.url = String(url);
    mockSockets.push(this);
  }

  send() {}

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }
}

export function takeLatestSocketOffline() {
  mockSockets.at(-1)?.onerror?.(new Event("error"));
}

export function hasMockSocket() {
  return mockSockets.length > 0;
}

Object.defineProperty(globalThis, "WebSocket", { value: MockWebSocket, configurable: true });
Object.defineProperty(Element.prototype, "scrollIntoView", { value: () => {}, configurable: true });

beforeEach(() => {
  localStorage.clear();
  mockSockets.length = 0;
});
afterEach(() => cleanup());
