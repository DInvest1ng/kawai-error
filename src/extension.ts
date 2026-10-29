import * as vscode from 'vscode';
import { AudioPlayer } from './audio';
import { KawaiiConfig, readConfig, SECTION } from './config';
import { DebugDetector } from './detectors/debugDetector';
import { Detector } from './detectors/detector';
import { DiagnosticsDetector } from './detectors/diagnosticsDetector';
import { TaskDetector } from './detectors/taskDetector';
import { TerminalDetector } from './detectors/terminalDetector';
import { ErrorBus } from './errorBus';
import { Reaction, ReactionPicker } from './reaction';
import type { ErrorBurst } from './types';
import { ShownEvent, WaifuViewProvider } from './waifuView';

/** Returned from activate(); used by the integration tests. */
export interface KawaiiApi {
  onReaction: vscode.Event<Reaction>;
  onWebviewShown: vscode.Event<ShownEvent>;
}

export function activate(context: vscode.ExtensionContext): KawaiiApi {
  let config = readConfig();
  const log = vscode.window.createOutputChannel('Kawaii Error');
  const audio = new AudioPlayer(vscode.Uri.joinPath(context.extensionUri, 'media', 'sounds').fsPath, log);
  const view = new WaifuViewProvider(context.extensionUri, () => config.spritesDirectory);
  const bus = new ErrorBus(busOptions(config));
  let picker = new ReactionPicker({ phrases: config.phrases });
  let detectors: Detector[] = [];
  const reactions = new vscode.EventEmitter<Reaction>();

  const startDetectors = () => {
    detectors.forEach((d) => d.dispose());
    detectors = config.enabled ? createDetectors(config) : [];
    for (const d of detectors) {
      d.onError((e) => bus.push(e));
    }
  };

  const react = (burst: ErrorBurst) => {
    const reaction = picker.pick(burst);
    log.appendLine(`[${burst.source}] x${burst.count} ${burst.message}`);
    void view.show(reaction, { durationMs: config.displayDuration * 1000, reveal: config.revealPanel });
    audio.play(reaction.sound, config.sound);
    reactions.fire(reaction);
  };

  startDetectors();
  bus.onBurst(react);

  context.subscriptions.push(
    reactions,
    log,
    audio,
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
      const previous = config;
      config = readConfig();
      if (previous.spritesDirectory !== config.spritesDirectory) {
        view.refresh();
      }
      bus.setOptions(busOptions(config));
      picker = new ReactionPicker({ phrases: config.phrases });
      startDetectors();
    }),
  );

  return { onReaction: reactions.event, onWebviewShown: view.onDidShow };
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
  if (config.detectors.tasks) {
    list.push(new TaskDetector());
  }
  if (config.detectors.terminal) {
    list.push(new TerminalDetector({ ignoreExitCodes: config.terminalIgnoreExitCodes }));
  }
  if (config.detectors.debug) {
    list.push(new DebugDetector());
  }
  return list;
}
