import * as vscode from 'vscode';
import { KawaiiConfig, readConfig, SECTION } from './config';
import { Detector } from './detectors/detector';
import { DiagnosticsDetector } from './detectors/diagnosticsDetector';
import { ErrorBus } from './errorBus';
import { ReactionPicker } from './reaction';
import type { ErrorBurst } from './types';
import { WaifuViewProvider } from './waifuView';

export function activate(context: vscode.ExtensionContext): void {
  let config = readConfig();
  const view = new WaifuViewProvider(context.extensionUri, () => undefined);
  const bus = new ErrorBus(busOptions(config));
  const picker = new ReactionPicker();
  let detectors: Detector[] = [];

  const startDetectors = () => {
    detectors.forEach((d) => d.dispose());
    detectors = config.enabled ? createDetectors(config) : [];
    for (const d of detectors) {
      d.onError((e) => bus.push(e));
    }
  };

  const react = (burst: ErrorBurst) => {
    const reaction = picker.pick(burst);
    void view.show(reaction, { durationMs: config.displayDuration * 1000, reveal: config.revealPanel });
  };

  startDetectors();
  bus.onBurst(react);

  context.subscriptions.push(
    view,
    { dispose: () => bus.dispose() },
    { dispose: () => detectors.forEach((d) => d.dispose()) },
    vscode.window.registerWebviewViewProvider(WaifuViewProvider.viewId, view),
    vscode.commands.registerCommand('kawaiiError.testReaction', () => {
      bus.emitNow({ source: 'test', message: 'Kawaii: Test reaction', severity: 'error', count: 1 });
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration(SECTION)) {
        return;
      }
      config = readConfig();
      bus.setOptions(busOptions(config));
      startDetectors();
    }),
  );
}

export function deactivate(): void {}

function busOptions(config: KawaiiConfig) {
  return { debounceMs: config.debounceMs, cooldownMs: config.cooldownSeconds * 1000 };
}

function createDetectors(config: KawaiiConfig): Detector[] {
  const list: Detector[] = [];
  if (config.detectors.diagnostics) {
    list.push(new DiagnosticsDetector({ onlyOnSave: config.diagnosticsOnlyOnSave }));
  }
  return list;
}
