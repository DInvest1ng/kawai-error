import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { Reaction } from './reaction';

const SPRITE_NAMES = ['idle', 'talk', 'worried', 'surprised', 'happy'] as const;
const SPRITE_EXTENSIONS = ['.png', '.gif', '.webp', '.svg'];

type ToWebview =
  | { type: 'init'; sprites: Record<string, string> }
  | { type: 'react'; reaction: Reaction; durationMs: number };

type FromWebview = { type: 'ready' };

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

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly getSpriteDirectory: () => string | undefined,
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

  /** Reload sprites, e.g. after the sprite directory setting changed. */
  refresh(): void {
    if (this.view) {
      this.ready = false;
      this.view.webview.options = { ...this.view.webview.options, localResourceRoots: this.resourceRoots() };
      this.view.webview.html = this.renderHtml(this.view.webview);
    }
  }

  dispose(): void {
    this.disposeViewListeners();
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
    if (this.view && this.ready && this.pending) {
      void this.view.webview.postMessage(this.pending);
      this.pending = undefined;
    }
  }

  private mediaUri(...segments: string[]): vscode.Uri {
    return vscode.Uri.joinPath(this.extensionUri, 'media', ...segments);
  }

  private resourceRoots(): vscode.Uri[] {
    const roots = [this.mediaUri()];
    const userDir = this.getSpriteDirectory();
    if (userDir) {
      roots.push(vscode.Uri.file(userDir));
    }
    return roots;
  }

  private initMessage(webview: vscode.Webview): ToWebview {
    const userDir = this.getSpriteDirectory();
    const dirs = [userDir, this.mediaUri('sprites').fsPath].filter((d): d is string => !!d);
    const sprites: Record<string, string> = {};
    for (const name of SPRITE_NAMES) {
      const file = findSprite(dirs, name);
      if (file) {
        sprites[name] = webview.asWebviewUri(vscode.Uri.file(file)).toString();
      }
    }
    return { type: 'init', sprites };
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

function findSprite(dirs: string[], name: string): string | undefined {
  for (const dir of dirs) {
    for (const ext of SPRITE_EXTENSIONS) {
      const file = path.join(dir, name + ext);
      if (fs.existsSync(file)) {
        return file;
      }
    }
  }
  return undefined;
}

function makeNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
