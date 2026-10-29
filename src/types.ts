export type ErrorSource = 'diagnostics' | 'task' | 'terminal' | 'debug' | 'test';
export type Severity = 'error' | 'warning';

/** A single error noticed by a detector. */
export interface ErrorEvent {
  source: ErrorSource;
  message: string;
  severity: Severity;
}

/** What the error bus emits after debouncing: the latest event plus how many were merged. */
export interface ErrorBurst extends ErrorEvent {
  count: number;
}
