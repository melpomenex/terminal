/**
 * MarketDataStreamClient — client-side WebSocket/SSE multiplexer.
 *
 * Features:
 * - Topic multiplexing over a single connection (`quotes:AAPL`, `trades:AAPL`, …)
 * - Subscription deduplication with ref-counting: N panels watching the same
 *   topic share one upstream subscription.
 * - Heartbeat monitoring with stale-feed detection.
 * - Exponential backoff reconnect (jittered), automatic SSE fallback when
 *   WebSocket is unavailable.
 * - Throttled fan-out so renderers can coalesce bursts (rAF-aligned batches).
 */

export type StreamChannel =
  | { topic: 'quotes'; symbol: string }
  | { topic: 'trades'; symbol: string }
  | { topic: 'depth'; symbol: string }
  | { topic: 'options'; symbol: string; expiration: string }
  | { topic: 'breaking_news' }
  | { topic: 'halts' };

export function channelKey(channel: StreamChannel): string {
  switch (channel.topic) {
    case 'quotes': return `quotes:${channel.symbol}`;
    case 'trades': return `trades:${channel.symbol}`;
    case 'depth': return `depth:${channel.symbol}`;
    case 'options': return `options:${channel.symbol}:${channel.expiration}`;
    default: return channel.topic;
  }
}

export type StreamConnectionState = 'CONNECTING' | 'OPEN' | 'RECONNECTING' | 'CLOSED';

export interface StreamMessage {
  key: string;
  data: unknown;
  serverTimestamp?: number;
}

type Listener = (data: unknown, key: string) => void;

const HEARTBEAT_INTERVAL_MS = 15_000;
const STALE_AFTER_MS = 45_000;
const MAX_BACKOFF_MS = 30_000;

export class MarketDataStreamClient {
  private ws: WebSocket | null = null;
  private es: EventSource | null = null;
  private transport: 'ws' | 'sse' | null = null;

  private listeners = new Map<string, Set<Listener>>();
  private stateListeners = new Set<(s: StreamConnectionState) => void>();

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastMessageAt = 0;
  private disposed = false;

  private _state: StreamConnectionState = 'CLOSED';
  private flushQueue: Array<StreamMessage> = [];
  private flushScheduled = false;

  get state(): StreamConnectionState { return this._state; }

  constructor(private endpoint = '/api/v2/stream') {}

  onStateChange(cb: (s: StreamConnectionState) => void): () => void {
    this.stateListeners.add(cb);
    cb(this._state);
    return () => this.stateListeners.delete(cb);
  }

  private setState(s: StreamConnectionState) {
    if (this._state === s) return;
    this._state = s;
    for (const cb of this.stateListeners) cb(s);
  }

  /** Subscribe to a channel. Returns an unsubscribe function. */
  subscribe(channel: StreamChannel, callback: Listener): () => void {
    const key = channelKey(channel);
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
      this.sendSubscription(key, 'SUBSCRIBE');
    }
    this.listeners.get(key)!.add(callback);

    return () => {
      const subs = this.listeners.get(key);
      if (!subs) return;
      subs.delete(callback);
      if (subs.size === 0) {
        this.listeners.delete(key);
        this.sendSubscription(key, 'UNSUBSCRIBE');
      }
    };
  }

  /** Seconds since last upstream message; Infinity when never connected. */
  get stalenessSeconds(): number {
    if (this.lastMessageAt === 0) return Number.POSITIVE_INFINITY;
    return (Date.now() - this.lastMessageAt) / 1000;
  }

  private connect() {
    if (this.disposed || this.ws || this.es) return;
    this.setState('CONNECTING');

    // Prefer WebSocket; fall back to SSE.
    try {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}${this.endpoint}`);
      this.ws = ws;
      this.transport = 'ws';
      ws.onopen = () => {
        this.setState('OPEN');
        this.reconnectAttempts = 0;
        this.lastMessageAt = Date.now();
        this.startHeartbeat();
        // Re-assert all active subscriptions after (re)connect.
        for (const key of this.listeners.keys()) this.sendSubscription(key, 'SUBSCRIBE');
      };
      ws.onmessage = (ev) => this.handleMessage(ev.data);
      ws.onclose = () => { this.ws = null; this.scheduleReconnect(); };
      ws.onerror = () => { try { ws.close(); } catch {} };
      return;
    } catch {
      this.ws = null;
    }

    this.connectSse();
  }

  private connectSse() {
    try {
      const url = `${this.endpoint}?transport=sse&topics=${encodeURIComponent([...this.listeners.keys()].join(','))}`;
      const es = new EventSource(url);
      this.es = es;
      this.transport = 'sse';
      es.onopen = () => {
        this.setState('OPEN');
        this.reconnectAttempts = 0;
        this.lastMessageAt = Date.now();
      };
      es.onmessage = (ev) => this.handleMessage(ev.data);
      es.onerror = () => {
        // EventSource auto-reconnects; only escalate if it stays broken.
        if (this.stalenessSeconds * 1000 > STALE_AFTER_MS * 2) {
          es.close(); this.es = null; this.scheduleReconnect();
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private handleMessage(raw: string) {
    this.lastMessageAt = Date.now();
    try {
      const msg = JSON.parse(raw) as StreamMessage | StreamMessage[];
      const batch = Array.isArray(msg) ? msg : [msg];
      this.enqueue(batch);
    } catch {
      // Ignore malformed frames; transport stays healthy.
    }
  }

  /** Coalesce bursts and flush once per animation frame. */
  private enqueue(batch: StreamMessage[]) {
    this.flushQueue.push(...batch);
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    const flush = () => {
      this.flushScheduled = false;
      const messages = this.flushQueue;
      this.flushQueue = [];
      for (const m of messages) {
        const subs = this.listeners.get(m.key);
        if (!subs) continue;
        for (const cb of subs) {
          try { cb(m.data, m.key); } catch { /* listener errors never kill the stream */ }
        }
      }
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush);
    else setTimeout(flush, 16);
  }

  private sendSubscription(key: string, action: 'SUBSCRIBE' | 'UNSUBSCRIBE') {
    if (this.transport === 'ws' && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, key }));
    }
    // SSE re-subscribes by reconnecting with the topic list.
    if (this.transport === 'sse' && this.es && action === 'SUBSCRIBE') {
      this.connectSseRefresh();
    }
    // Lazy connect on first subscription.
    if (!this.ws && !this.es) this.connect();
  }

  private connectSseRefresh() {
    // SSE topic lists are fixed per connection; refresh cheaply.
    if (!this.es) return;
    this.es.close();
    this.es = null;
    this.connectSse();
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.stalenessSeconds * 1000 > STALE_AFTER_MS) {
        // Feed went quiet beyond tolerance — treat as dead and reconnect.
        this.teardownTransport();
        this.scheduleReconnect();
      } else if (this.transport === 'ws' && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: 'PING' }));
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }

  private teardownTransport() {
    this.stopHeartbeat();
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
    if (this.es) { this.es.close(); this.es = null; }
    this.transport = null;
  }

  private scheduleReconnect() {
    if (this.disposed || this.reconnectTimer) return;
    this.setState('RECONNECTING');
    const attempt = ++this.reconnectAttempts;
    const base = Math.min(1000 * 2 ** Math.min(attempt, 6), MAX_BACKOFF_MS);
    const jitter = base * (0.5 + Math.random() * 0.5);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, jitter);
  }

  dispose() {
    this.disposed = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.teardownTransport();
    this.setState('CLOSED');
  }
}

let singleton: MarketDataStreamClient | null = null;

/** Shared client for the whole terminal (one multiplexed connection). */
export function getStreamClient(): MarketDataStreamClient {
  if (!singleton) singleton = new MarketDataStreamClient();
  return singleton;
}
