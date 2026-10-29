import * as vscode from 'vscode';

export const SECTION = 'kawaiiError';

export interface KawaiiConfig {
  enabled: boolean;
  debounceMs: number;
  cooldownSeconds: number;
  displayDuration: number;
  revealPanel: boolean;
  detectors: {
    diagnostics: boolean;
  };
  diagnosticsOnlyOnSave: boolean;
  spritesDirectory?: string;
  sound: {
    enabled: boolean;
    volume: number;
    directory?: string;
  };
}

export function readConfig(): KawaiiConfig {
  const c = vscode.workspace.getConfiguration(SECTION);
  return {
    enabled: c.get('enabled', true),
    debounceMs: Math.max(0, c.get('debounceMs', 1500)),
    cooldownSeconds: Math.max(0, c.get('cooldownSeconds', 10)),
    displayDuration: Math.max(1, c.get('displayDuration', 6)),
    revealPanel: c.get('revealPanel', true),
    detectors: {
      diagnostics: c.get('detectors.diagnostics', true),
    },
    diagnosticsOnlyOnSave: c.get('diagnostics.onlyOnSave', false),
    spritesDirectory: c.get<string>('sprites.directory')?.trim() || undefined,
    sound: {
      enabled: c.get('sound.enabled', true),
      volume: Math.min(100, Math.max(0, c.get('sound.volume', 70))),
      directory: c.get<string>('sound.directory')?.trim() || undefined,
    },
  };
}
