import * as vscode from 'vscode';
import { Detector } from './detector';

export interface TerminalDetectorOptions {
  /** Exit codes that are not errors, e.g. 130 for Ctrl+C. */
  ignoreExitCodes: readonly number[];
}

/** Fires when a command run in an integrated terminal exits with a non-zero code. Needs shell integration. */
export class TerminalDetector extends Detector {
  constructor(options: TerminalDetectorOptions) {
    super();
    this.disposables.push(
      vscode.window.onDidEndTerminalShellExecution((e) => {
        const code = e.exitCode;
        if (code === undefined || code === 0 || options.ignoreExitCodes.includes(code)) {
          return;
        }
        const command = e.execution.commandLine.value.trim() || e.terminal.name;
        this.emit({
          source: 'terminal',
          severity: 'error',
          message: `$ ${truncate(command, 120)} → код ${code}`,
        });
      }),
    );
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
