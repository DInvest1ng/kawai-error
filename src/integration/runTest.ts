import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  const root = path.resolve(__dirname, '../..');
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'kawaii-ws-'));
  fs.writeFileSync(path.join(workspace, 'throws.js'), "setTimeout(() => { throw new Error('kawaii test boom'); }, 200);\n");
  fs.mkdirSync(path.join(workspace, '.vscode'));
  fs.writeFileSync(
    path.join(workspace, '.vscode', 'settings.json'),
    JSON.stringify(
      {
        'kawaiiError.debounceMs': 200,
        'kawaiiError.cooldownSeconds': 0,
        'kawaiiError.sound.volume': 15,
        'terminal.integrated.shellIntegration.enabled': true,
      },
      null,
      2,
    ),
  );

  try {
    await runTests({
      version: process.env.VSCODE_TEST_VERSION ?? 'stable',
      extensionDevelopmentPath: root,
      extensionTestsPath: path.join(__dirname, 'suite'),
      launchArgs: [workspace, '--disable-extensions', '--skip-welcome', '--skip-release-notes'],
    });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
