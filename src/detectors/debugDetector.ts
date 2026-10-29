import * as vscode from 'vscode';
import { Detector } from './detector';

interface StoppedEvent {
  type: 'event';
  event: 'stopped';
  body?: { reason?: string; description?: string; text?: string };
}

function isExceptionStop(message: unknown): message is StoppedEvent {
  const m = message as Partial<StoppedEvent> | undefined;
  return m?.type === 'event' && m.event === 'stopped' && m.body?.reason === 'exception';
}

/** Fires when any debug session stops on an exception (DAP `stopped` event with reason `exception`). */
export class DebugDetector extends Detector {
  constructor() {
    super();
    this.disposables.push(
      vscode.debug.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker: (session) => ({
          onDidSendMessage: (message: unknown) => {
            if (isExceptionStop(message)) {
              const text = message.body?.text || message.body?.description || 'Исключение';
              this.emit({ source: 'debug', severity: 'error', message: `${session.name}: ${text}` });
            }
          },
        }),
      }),
    );
  }
}
