import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { KawaiiApi } from '../extension';
import type { Reaction } from '../reaction';
import type { ErrorSource } from '../types';

type Test = [name: string, fn: (api: KawaiiApi) => Promise<void>];

/** Waits for the next reaction from `source`, failing after `timeoutMs`. */
function nextReaction(api: KawaiiApi, source: ErrorSource, timeoutMs = 15_000): Promise<Reaction> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sub.dispose();
      reject(new Error(`no "${source}" reaction within ${timeoutMs}ms`));
    }, timeoutMs);
    const sub = api.onReaction((r) => {
      if (r.source === source) {
        clearTimeout(timer);
        sub.dispose();
        resolve(r);
      }
    });
  });
}

function expectNoReaction(api: KawaiiApi, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const sub = api.onReaction((r) => {
      sub.dispose();
      reject(new Error(`unexpected reaction from ${r.source}: ${r.detail}`));
    });
    setTimeout(() => {
      sub.dispose();
      resolve();
    }, ms);
  });
}

const workspaceDir = () => vscode.workspace.workspaceFolders![0].uri.fsPath;

const tests: Test[] = [
  [
    'test command shows the girl in the webview with a loaded sprite',
    async (api) => {
      const shown = new Promise<{ sprite: string; loaded: boolean }>((resolve) => {
        const sub = api.onWebviewShown((e) => {
          sub.dispose();
          resolve(e);
        });
      });
      const reaction = nextReaction(api, 'test');
      await vscode.commands.executeCommand('kawaiiError.testReaction');
      const r = await reaction;
      assert.equal(r.emotion, 'happy');
      assert.equal(r.voice, 'voice-test');
      const ext = vscode.extensions.getExtension('d-istomin.kawaii-error')!;
      assert.ok(fs.existsSync(path.join(ext.extensionPath, 'media', 'characters', 'natsuki', 'voice-test.wav')));
      const s = await Promise.race([
        shown,
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('webview never reported the sprite')), 15_000)),
      ]);
      assert.deepEqual(s, { sprite: 'happy', loaded: true });
    },
  ],
  [
    'character: switching to Kurilov changes his lines and loads his sprite; the picker command exists',
    async (api) => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('kawaiiError.chooseCharacter'));
      const config = vscode.workspace.getConfiguration('kawaiiError');
      await config.update('character', 'kurilov', vscode.ConfigurationTarget.Global);
      try {
        await new Promise((r) => setTimeout(r, 300));
        const shown = new Promise<{ sprite: string; loaded: boolean }>((resolve) => {
          const sub = api.onWebviewShown((e) => {
            sub.dispose();
            resolve(e);
          });
        });
        const reaction = nextReaction(api, 'test');
        await vscode.commands.executeCommand('kawaiiError.testReaction');
        const r = await reaction;
        assert.equal(r.phrase, 'Проверка связи. Всё работает!');
        const s = await Promise.race([
          shown,
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('webview never reported the sprite')), 15_000)),
        ]);
        assert.deepEqual(s, { sprite: 'happy', loaded: true });
      } finally {
        await config.update('character', undefined, vscode.ConfigurationTarget.Global);
      }
    },
  ],
  [
    'diagnostics: a new Error reacts, a warning or an unchanged count does not',
    async (api) => {
      const collection = vscode.languages.createDiagnosticCollection('kawaii-test');
      const uri = vscode.Uri.file(path.join(workspaceDir(), 'fake.ts'));
      const range = new vscode.Range(4, 0, 4, 5);
      try {
        collection.set(uri, [new vscode.Diagnostic(range, 'just a warning', vscode.DiagnosticSeverity.Warning)]);
        await expectNoReaction(api, 1000);

        const reaction = nextReaction(api, 'diagnostics');
        collection.set(uri, [new vscode.Diagnostic(range, "Cannot find name 'foo'", vscode.DiagnosticSeverity.Error)]);
        const r = await reaction;
        assert.match(r.detail, /fake\.ts:5 Cannot find name 'foo'/);
        assert.ok(r.phrase.length > 0);

        // Same number of errors again: nothing new.
        collection.set(uri, [new vscode.Diagnostic(range, "Cannot find name 'bar'", vscode.DiagnosticSeverity.Error)]);
        await expectNoReaction(api, 1000);
      } finally {
        collection.dispose();
      }
    },
  ],
  [
    'task: a shell task exiting with code 3 reacts',
    async (api) => {
      const task = new vscode.Task(
        { type: 'shell' },
        vscode.TaskScope.Workspace,
        'kawaii-failing-task',
        'kawaii',
        new vscode.ShellExecution('exit 3'),
      );
      const reaction = nextReaction(api, 'task');
      await vscode.tasks.executeTask(task);
      const r = await reaction;
      assert.match(r.detail, /kawaii-failing-task.*3/);
    },
  ],
  [
    'terminal: a command failing in the integrated terminal reacts',
    async (api) => {
      // bash: zsh shell integration does not come up reliably inside the downloaded test instance.
      const shellPath = process.platform === 'win32' ? undefined : (process.env.KAWAII_SHELL ?? '/bin/bash');
      const terminal = vscode.window.createTerminal({ name: 'kawaii-test', shellPath });
      terminal.show(true);
      try {
        const integration =
          terminal.shellIntegration ??
          (await new Promise<vscode.TerminalShellIntegration>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('shell integration did not activate')), 30_000);
            const sub = vscode.window.onDidChangeTerminalShellIntegration((e) => {
              if (e.terminal === terminal) {
                clearTimeout(timer);
                sub.dispose();
                resolve(e.shellIntegration);
              }
            });
          }));
        const reaction = nextReaction(api, 'terminal');
        integration.executeCommand('sh -c "exit 7"');
        const r = await reaction;
        assert.match(r.detail, /exit 7.*7/);
      } finally {
        terminal.dispose();
      }
    },
  ],
  [
    'debug: a program dying of an uncaught exception under the Node debugger reacts',
    async (api) => {
      const reaction = nextReaction(api, 'debug', 30_000);
      const started = await vscode.debug.startDebugging(vscode.workspace.workspaceFolders![0], {
        type: 'node',
        request: 'launch',
        name: 'kawaii-throws',
        program: path.join(workspaceDir(), 'throws.js'),
      });
      assert.ok(started, 'debug session did not start');
      try {
        const r = await reaction;
        assert.match(r.detail, /кодом 1/);
      } finally {
        await vscode.debug.stopDebugging();
      }
    },
  ],
];

/** Logs raw VS Code events so a failing test shows whether the event or the detector is missing. */
function traceRawEvents(): vscode.Disposable {
  return vscode.Disposable.from(
    vscode.tasks.onDidStartTaskProcess((e) => console.log(`    [raw] task process started: ${e.execution.task.name}`)),
    vscode.tasks.onDidEndTaskProcess((e) => console.log(`    [raw] task process ended: code=${e.exitCode}`)),
    vscode.window.onDidOpenTerminal((t) => console.log(`    [raw] terminal opened: ${t.name}`)),
    vscode.window.onDidCloseTerminal((t) => console.log(`    [raw] terminal closed: ${t.name} exit=${t.exitStatus?.code}`)),
    vscode.window.onDidEndTerminalShellExecution((e) => console.log(`    [raw] shell execution ended: code=${e.exitCode}`)),
    vscode.debug.onDidStartDebugSession((s) => console.log(`    [raw] debug session started: ${s.name} (${s.type})`)),
    vscode.debug.onDidTerminateDebugSession((s) => console.log(`    [raw] debug session ended: ${s.name}`)),
    vscode.debug.registerDebugAdapterTrackerFactory('*', {
      createDebugAdapterTracker: () => ({
        onDidSendMessage: (m: { type?: string; event?: string; body?: { reason?: string } }) => {
          if (m.type === 'event' && (m.event === 'stopped' || m.event === 'exited')) {
            console.log(`    [raw] dap ${m.event}: ${JSON.stringify(m.body).slice(0, 160)}`);
          }
        },
        onError: (e: Error) => console.log(`    [raw] dap error: ${e.message}`),
      }),
    }),
  );
}

export async function run(): Promise<void> {
  const trace = process.env.KAWAII_TRACE ? traceRawEvents() : undefined;
  const ext = vscode.extensions.getExtension<KawaiiApi>('d-istomin.kawaii-error');
  assert.ok(ext, 'extension not found');
  const api = await ext.activate();

  const failures: string[] = [];
  for (const [name, fn] of tests) {
    try {
      await fn(api);
      console.log(`  ✔ ${name}`);
    } catch (err) {
      console.log(`  ✖ ${name}\n      ${(err as Error).message}`);
      failures.push(name);
    }
  }
  trace?.dispose();
  console.log(`\n${tests.length - failures.length} passing, ${failures.length} failing`);
  if (failures.length > 0) {
    throw new Error(`${failures.length} integration test(s) failed`);
  }
}
