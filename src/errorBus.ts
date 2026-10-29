import type { ErrorBurst, ErrorEvent, ErrorSource } from './types';

export interface ErrorBusOptions {
  /** Events closer together than this are merged into one burst. */
  debounceMs: number;
  /** Minimum time between two emitted bursts; bursts inside it are dropped. */
  cooldownMs: number;
}

type Listener = (burst: ErrorBurst) => void;

const SEVERITY_RANK = { warning: 0, error: 1 } as const;

/**
 * When severities tie, the more specific source explains the burst better. A failing task, for
 * example, also ends a shell execution in its terminal; the burst should say "task", not "terminal".
 */
const SOURCE_RANK: Record<ErrorSource, number> = { terminal: 0, diagnostics: 1, task: 2, debug: 3, test: 4 };

/** Does `prev` explain the burst better than the newer `next`? Ties go to the newer event. */
function outranks(prev: ErrorEvent, next: ErrorEvent): boolean {
  const bySeverity = SEVERITY_RANK[prev.severity] - SEVERITY_RANK[next.severity];
  return bySeverity !== 0 ? bySeverity > 0 : SOURCE_RANK[prev.source] > SOURCE_RANK[next.source];
}

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
      this.pending = { ...(outranks(prev, event) ? prev : event), count: prev.count + 1 };
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
