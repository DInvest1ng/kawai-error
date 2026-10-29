import * as vscode from 'vscode';
import { ReactionPicker } from './reaction';
import { WaifuViewProvider } from './waifuView';

export function activate(context: vscode.ExtensionContext): void {
  const view = new WaifuViewProvider(context.extensionUri, () => undefined);
  const picker = new ReactionPicker();

  context.subscriptions.push(
    view,
    vscode.window.registerWebviewViewProvider(WaifuViewProvider.viewId, view),
    vscode.commands.registerCommand('kawaiiError.testReaction', () => {
      const reaction = picker.pick({ source: 'test', message: 'Kawaii: Test reaction', severity: 'error', count: 1 });
      return view.show(reaction, { durationMs: 6000, reveal: true });
    }),
  );
}

export function deactivate(): void {}
