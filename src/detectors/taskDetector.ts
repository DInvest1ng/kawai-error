import * as vscode from 'vscode';
import { Detector } from './detector';

/** Fires when a task process exits with a non-zero code. */
export class TaskDetector extends Detector {
  constructor() {
    super();
    this.disposables.push(
      vscode.tasks.onDidEndTaskProcess((e) => {
        if (e.exitCode !== undefined && e.exitCode !== 0) {
          this.emit({
            source: 'task',
            severity: 'error',
            message: `Задача «${e.execution.task.name}» завершилась с кодом ${e.exitCode}`,
          });
        }
      }),
    );
  }
}
