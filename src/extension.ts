import * as vscode from 'vscode';
import { AudioPlayer } from './audio';
import { loadCharacters, resolveCharacter } from './characters';
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
  const characters = loadCharacters(vscode.Uri.joinPath(context.extensionUri, 'media', 'characters').fsPath);
  let character = resolveCharacter(characters, config.character);
  const view = new WaifuViewProvider(context.extensionUri, () => ({
    characters,
    current: character,
    spritesDirectory: config.spritesDirectory,
  }));
  const bus = new ErrorBus(busOptions(config));
  const newPicker = () => new ReactionPicker({ character, phrases: config.phrases });
  let picker = newPicker();
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
    audio.play(reaction.sound, config.sound, reaction.voice, character?.dir);
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
    vscode.commands.registerCommand('kawaiiError.chooseCharacter', () => view.openPicker()),
    view.onDidSelectCharacter(async (id) => {
      if (!characters.some((c) => c.id === id)) {
        return;
      }
      if (id !== character?.id) {
        await vscode.workspace.getConfiguration(SECTION).update('character', id, vscode.ConfigurationTarget.Global);
        // Don't wait for onDidChangeConfiguration: the hello below must come from the new character.
        character = resolveCharacter(characters, id);
        picker = newPicker();
        view.update();
      }
      // The new character says hello.
      bus.emitNow({ source: 'test', message: `${character?.name ?? id} ♡`, severity: 'error', count: 1 });
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration(SECTION)) {
        return;
      }
      const previous = config;
      config = readConfig();
      character = resolveCharacter(characters, config.character);
      if (previous.spritesDirectory !== config.spritesDirectory) {
        view.refresh();
      } else if (previous.character !== config.character) {
        view.update();
      }
      bus.setOptions(busOptions(config));
      picker = newPicker();
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
