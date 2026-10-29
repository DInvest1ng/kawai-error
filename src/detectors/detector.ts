import * as vscode from 'vscode';
import type { ErrorEvent } from '../types';

/** A source of errors. Each detector owns its VS Code subscriptions. */
export abstract class Detector implements vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<ErrorEvent>();
  readonly onError: vscode.Event<ErrorEvent> = this.emitter.event;
  protected readonly disposables: vscode.Disposable[] = [this.emitter];

  protected emit(event: ErrorEvent): void {
    this.emitter.fire(event);
  }

  dispose(): void {
    vscode.Disposable.from(...this.disposables).dispose();
  }
}
