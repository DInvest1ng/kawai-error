import * as vscode from 'vscode';
import { Detector } from './detector';

interface DapEvent {
  type: 'event';
  event: string;
  body?: { reason?: string; description?: string; text?: string; exitCode?: number; output?: string; category?: string };
}

function asEvent(message: unknown, name: string): DapEvent | undefined {
  const m = message as Partial<DapEvent> | undefined;
  return m?.type === 'event' && m.event === name ? (m as DapEvent) : undefined;
}

/** js-debug (Node/JS) reports the debuggee's exit only as a line of output, not as an `exited` event. */
function exitCodeFromOutput(message: unknown): number | undefined {
  const output = asEvent(message, 'output')?.body?.output;
  const match = output && /^Process exited with code (-?\d+)/.exec(output.trim());
  return match ? Number(match[1]) : undefined;
}

/**
 * Fires when a debug session stops on an exception (DAP `stopped`, reason `exception`), or when the
 * debuggee exits with a non-zero code. The second case matters because most debuggers do not pause
 * on uncaught exceptions unless the user enables that breakpoint: the program just dies.
 */
export class DebugDetector extends Detector {
  constructor() {
    super();
    this.disposables.push(
      vscode.debug.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker: (session) => ({
          onDidSendMessage: (message: unknown) => {
            const stopped = asEvent(message, 'stopped');
            if (stopped?.body?.reason === 'exception') {
              const text = stopped.body.text || stopped.body.description || 'Исключение';
              this.emit({ source: 'debug', severity: 'error', message: `${session.name}: ${text}` });
              return;
            }
            const exitCode = asEvent(message, 'exited')?.body?.exitCode ?? exitCodeFromOutput(message);
            if (exitCode !== undefined && exitCode !== 0) {
              this.emit({
                source: 'debug',
                severity: 'error',
                message: `${session.name}: программа завершилась с кодом ${exitCode}`,
              });
            }
          },
        }),
      }),
    );
  }
}
