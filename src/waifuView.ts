import * as fs from 'fs';
import * as vscode from 'vscode';
import { Character, findSprite, SPRITE_NAMES } from './characters';
import type { Reaction } from './reaction';

interface CharacterCard {
  id: string;
  name: string;
  sprites: Record<string, string>;
}

type ToWebview =
  | { type: 'init'; characters: CharacterCard[]; current: string }
  | { type: 'react'; reaction: Reaction; durationMs: number }
  | { type: 'openPicker' };

type FromWebview =
  | { type: 'ready' }
  | { type: 'shown'; sprite: string; loaded: boolean }
  | { type: 'select'; id: string };

/** What the view shows: all packs, the chosen one, and the user's sprite folder (overrides the chosen pack). */
export interface ViewState {
  characters: readonly Character[];
  current?: Character;
  spritesDirectory?: string;
}

/** Reported by the webview once a reaction's sprite has loaded (or failed to). */
export interface ShownEvent {
  sprite: string;
  loaded: boolean;
}

export interface ShowOptions {
  durationMs: number;
  reveal: boolean;
}

export class WaifuViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewId = 'kawaiiError.view';

  private view?: vscode.WebviewView;
  private ready = false;
  /** Only the latest reaction is worth showing once the view comes up. */
  private pending?: ToWebview;
  /** Listeners of the currently resolved view; replaced when VS Code resolves the view again. */
  private viewDisposables: vscode.Disposable[] = [];
  private pickerRequested = false;
  private readonly shownEmitter = new vscode.EventEmitter<ShownEvent>();
  readonly onDidShow = this.shownEmitter.event;
  private readonly selectEmitter = new vscode.EventEmitter<string>();
  /** Fires with a character id chosen in the carousel. */
  readonly onDidSelectCharacter = this.selectEmitter.event;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly getState: () => ViewState,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.disposeViewListeners();
    this.view = view;
    this.ready = false;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: this.resourceRoots(),
    };
    view.webview.html = this.renderHtml(view.webview);

    this.viewDisposables = [
      view.webview.onDidReceiveMessage((msg: FromWebview) => {
        if (msg.type === 'ready') {
          this.ready = true;
          void view.webview.postMessage(this.initMessage(view.webview));
          this.flush();
        } else if (msg.type === 'shown') {
          this.shownEmitter.fire({ sprite: msg.sprite, loaded: msg.loaded });
        } else if (msg.type === 'select') {
          this.selectEmitter.fire(msg.id);
        }
      }),
      // Without retainContextWhenHidden the page is torn down when hidden and sends 'ready' again.
      view.onDidChangeVisibility(() => {
        if (!view.visible) {
          this.ready = false;
        }
      }),
      view.onDidDispose(() => {
        this.view = undefined;
        this.ready = false;
        this.disposeViewListeners();
      }),
    ];
  }

  async show(reaction: Reaction, options: ShowOptions): Promise<void> {
    this.pending = { type: 'react', reaction, durationMs: options.durationMs };
    if (options.reveal) {
      await this.reveal();
    }
    this.flush();
  }

  /** Shows the character carousel, revealing the panel first. */
  async openPicker(): Promise<void> {
    this.pickerRequested = true;
    await this.reveal();
    this.flush();
  }

  /** Re-send the characters, e.g. after another one was chosen. */
  update(): void {
    if (this.view && this.ready) {
      void this.view.webview.postMessage(this.initMessage(this.view.webview));
    }
  }

  /** Reload the page, e.g. after the sprite directory setting changed (resource roots change too). */
  refresh(): void {
    if (this.view) {
      this.ready = false;
      this.view.webview.options = { ...this.view.webview.options, localResourceRoots: this.resourceRoots() };
      this.view.webview.html = this.renderHtml(this.view.webview);
    }
  }

  dispose(): void {
    this.disposeViewListeners();
    this.shownEmitter.dispose();
    this.selectEmitter.dispose();
  }

  private disposeViewListeners(): void {
    this.viewDisposables.forEach((d) => d.dispose());
    this.viewDisposables = [];
  }

  private async reveal(): Promise<void> {
    if (this.view) {
      if (!this.view.visible) {
        this.view.show(true);
      }
      return;
    }
    // The view has never been resolved: the focus command is the only way to create it.
    const hadEditorFocus = vscode.window.activeTextEditor !== undefined;
    await vscode.commands.executeCommand(`${WaifuViewProvider.viewId}.focus`);
    if (hadEditorFocus) {
      await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
    }
  }

  private flush(): void {
    if (!this.view || !this.ready) {
      return;
    }
    if (this.pending) {
      void this.view.webview.postMessage(this.pending);
      this.pending = undefined;
    }
    if (this.pickerRequested) {
      void this.view.webview.postMessage({ type: 'openPicker' } satisfies ToWebview);
      this.pickerRequested = false;
    }
  }

  private mediaUri(...segments: string[]): vscode.Uri {
    return vscode.Uri.joinPath(this.extensionUri, 'media', ...segments);
  }

  private resourceRoots(): vscode.Uri[] {
    const roots = [this.mediaUri()];
    const userDir = this.getState().spritesDirectory;
    if (userDir) {
      roots.push(vscode.Uri.file(userDir));
    }
    return roots;
  }

  private initMessage(webview: vscode.Webview): ToWebview {
    const { characters, current, spritesDirectory } = this.getState();
    const cards = characters.map((c) => {
      // The user's sprite folder overrides only the chosen character.
      const dirs = [c === current ? spritesDirectory : undefined, c.dir].filter((d): d is string => !!d);
      const sprites: Record<string, string> = {};
      for (const name of SPRITE_NAMES) {
        const file = findSprite(dirs, name);
        if (file) {
          sprites[name] = webview.asWebviewUri(vscode.Uri.file(file)).toString();
        }
      }
      return { id: c.id, name: c.name, sprites };
    });
    return { type: 'init', characters: cards, current: current?.id ?? '' };
  }

  private renderHtml(webview: vscode.Webview): string {
    const template = fs.readFileSync(this.mediaUri('webview.html').fsPath, 'utf8');
    const nonce = makeNonce();
    const values: Record<string, string> = {
      cspSource: webview.cspSource,
      nonce,
      styleUri: webview.asWebviewUri(this.mediaUri('webview.css')).toString(),
      scriptUri: webview.asWebviewUri(this.mediaUri('webview.js')).toString(),
    };
    return template.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => values[key] ?? match);
  }
}

function makeNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
