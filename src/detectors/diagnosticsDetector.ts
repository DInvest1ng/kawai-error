import * as path from 'path';
import * as vscode from 'vscode';
import { Detector } from './detector';

/** After a save, diagnostic updates within this window are attributed to the save. */
const SAVE_WINDOW_MS = 3000;

export interface DiagnosticsDetectorOptions {
  /** React only to errors that show up right after a file is saved. */
  onlyOnSave: boolean;
}

/** Fires when the number of Error diagnostics grows. */
export class DiagnosticsDetector extends Detector {
  /** uri -> keys of its current Error diagnostics. */
  private readonly known = new Map<string, Set<string>>();
  private saveWindowEnd = 0;

  constructor(private readonly options: DiagnosticsDetectorOptions) {
    super();
    // Errors that exist at startup are the baseline, not news.
    for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
      this.remember(uri, errorsOf(diagnostics));
    }

    this.disposables.push(
      vscode.languages.onDidChangeDiagnostics((e) => {
        if (!this.options.onlyOnSave || Date.now() <= this.saveWindowEnd) {
          this.evaluate(e.uris);
        }
      }),
    );
    if (options.onlyOnSave) {
      this.disposables.push(
        vscode.workspace.onDidSaveTextDocument((doc) => {
          this.saveWindowEnd = Date.now() + SAVE_WINDOW_MS;
          this.evaluate([doc.uri]);
        }),
      );
    }
  }

  private evaluate(uris: readonly vscode.Uri[]): void {
    let before = 0;
    let after = 0;
    let firstNew: { uri: vscode.Uri; diagnostic: vscode.Diagnostic } | undefined;

    for (const uri of uris) {
      const previous = this.known.get(uri.toString()) ?? new Set<string>();
      const current = errorsOf(vscode.languages.getDiagnostics(uri));
      before += previous.size;
      after += current.length;
      firstNew ??= firstMatch(current, (d) => !previous.has(keyOf(d)), uri);
      this.remember(uri, current);
    }

    if (after > before) {
      this.emit({
        source: 'diagnostics',
        severity: 'error',
        message: firstNew ? describe(firstNew.uri, firstNew.diagnostic) : `Ошибок: ${after}`,
      });
    }
  }

  private remember(uri: vscode.Uri, errors: vscode.Diagnostic[]): void {
    if (errors.length === 0) {
      this.known.delete(uri.toString());
    } else {
      this.known.set(uri.toString(), new Set(errors.map(keyOf)));
    }
  }
}

function errorsOf(diagnostics: readonly vscode.Diagnostic[]): vscode.Diagnostic[] {
  return diagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Error);
}

function keyOf(d: vscode.Diagnostic): string {
  return `${d.range.start.line}:${d.range.start.character}:${d.message}`;
}

function firstMatch(
  diagnostics: vscode.Diagnostic[],
  predicate: (d: vscode.Diagnostic) => boolean,
  uri: vscode.Uri,
): { uri: vscode.Uri; diagnostic: vscode.Diagnostic } | undefined {
  const diagnostic = diagnostics.find(predicate);
  return diagnostic ? { uri, diagnostic } : undefined;
}

function describe(uri: vscode.Uri, d: vscode.Diagnostic): string {
  const file = uri.scheme === 'file' ? path.basename(uri.fsPath) : uri.path.split('/').pop();
  return `${file}:${d.range.start.line + 1} ${d.message.split('\n')[0]}`;
}
