import type { ErrorBurst, ErrorEvent } from './types';

export interface ErrorBusOptions {
  /** Events closer together than this are merged into one burst. */
  debounceMs: number;
  /** Minimum time between two emitted bursts; bursts inside it are dropped. */
  cooldownMs: number;
}

type Listener = (burst: ErrorBurst) => void;

const SEVERITY_RANK = { warning: 0, error: 1 } as const;

/**
 * Collects error events from all detectors, debounces them (trailing edge) and
 * enforces a cooldown so the user is not spammed. Has no VS Code dependency.
 */
export class ErrorBus {
  private readonly listeners = new Set<Listener>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: ErrorBurst | undefined;
  private lastEmit = Number.NEGATIVE_INFINITY;

  constructor(private options: ErrorBusOptions) {}

  onBurst(listener: Listener): { dispose(): void } {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  setOptions(options: ErrorBusOptions): void {
    this.options = options;
  }

  push(event: ErrorEvent): void {
    const prev = this.pending;
    if (!prev) {
      this.pending = { ...event, count: 1 };
    } else {
      // Keep the most recent event of the highest severity seen in this burst.
      const keepPrev = SEVERITY_RANK[prev.severity] > SEVERITY_RANK[event.severity];
      this.pending = { ...(keepPrev ? prev : event), count: prev.count + 1 };
    }

    if (this.timer !== undefined) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.flush(), this.options.debounceMs);
  }

  /** Emit a burst right away, bypassing debounce and cooldown (used by the test command). */
  emitNow(burst: ErrorBurst): void {
    this.lastEmit = Date.now();
    this.listeners.forEach((l) => l(burst));
  }

  dispose(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
    }
    this.timer = undefined;
    this.pending = undefined;
    this.listeners.clear();
  }

  private flush(): void {
    const burst = this.pending;
    this.timer = undefined;
    this.pending = undefined;
    if (!burst) {
      return;
    }
    const now = Date.now();
    if (now - this.lastEmit < this.options.cooldownMs) {
      return;
    }
    this.lastEmit = now;
    this.listeners.forEach((l) => l(burst));
  }
}
