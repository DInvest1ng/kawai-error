import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type * as vscode from 'vscode';

export interface AudioSettings {
  enabled: boolean;
  /** 0..100 */
  volume: number;
  /** Optional user folder with .wav files, searched before the bundled sounds. */
  directory?: string;
}

interface Command {
  file: string;
  args: string[];
}

/** Plays .wav files through the platform's own command-line player. */
export class AudioPlayer implements vscode.Disposable {
  private current?: ChildProcess;

  constructor(
    private readonly bundledDir: string,
    private readonly log: vscode.OutputChannel,
  ) {}

  /**
   * Plays `<voice>.wav` if there is one (user folder, then the character's folder),
   * otherwise a `<sound>*.wav`.
   */
  play(sound: string, settings: AudioSettings, voice?: string, characterDir?: string): void {
    if (!settings.enabled || settings.volume <= 0) {
      return;
    }
    const file =
      (voice && this.resolveExact(voice, [settings.directory, characterDir])) || this.resolve(sound, settings.directory);
    if (!file) {
      this.log.appendLine(`[audio] no .wav found for "${sound}"`);
      return;
    }
    this.stop();
    const volume = Math.min(100, settings.volume) / 100;
    const [primary, fallback] = commandsFor(process.platform, file, volume);
    if (!primary) {
      this.log.appendLine(`[audio] unsupported platform: ${process.platform}`);
      return;
    }
    this.run(primary, fallback);
  }

  stop(): void {
    this.current?.kill();
    this.current = undefined;
  }

  dispose(): void {
    this.stop();
  }

  private run(command: Command, fallback?: Command): void {
    const child = spawn(command.file, command.args, { stdio: 'ignore', windowsHide: true });
    this.current = child;
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT' && fallback) {
        this.log.appendLine(`[audio] ${command.file} not found, trying ${fallback.file}`);
        this.run(fallback);
      } else {
        this.log.appendLine(`[audio] ${command.file} failed: ${err.message}`);
      }
    });
    child.on('exit', (code, signal) => {
      if (this.current === child) {
        this.current = undefined;
      }
      if (code !== 0 && code !== null && !signal) {
        this.log.appendLine(`[audio] ${command.file} exited with code ${code}`);
      }
    });
  }

  private resolveExact(name: string, extraDirs: (string | undefined)[]): string | undefined {
    const wanted = `${name}.wav`.toLowerCase();
    const dirs = [...extraDirs, this.bundledDir].filter((d): d is string => !!d);
    for (const dir of dirs) {
      const file = listWavs(dir).find((f) => path.basename(f).toLowerCase() === wanted);
      if (file) {
        return file;
      }
    }
    return undefined;
  }

  private dirs(userDir?: string): string[] {
    return [userDir, this.bundledDir].filter((d): d is string => !!d);
  }

  private resolve(sound: string, userDir?: string): string | undefined {
    const wavsByDir = this.dirs(userDir).map(listWavs);
    for (const wavs of wavsByDir) {
      const matching = wavs.filter((f) => path.basename(f).toLowerCase().startsWith(sound.toLowerCase()));
      if (matching.length > 0) {
        return randomItem(matching);
      }
    }
    const any = wavsByDir.find((wavs) => wavs.length > 0);
    return any ? randomItem(any) : undefined;
  }
}

/** Returns the player command and, on Linux, a fallback for systems without PulseAudio/PipeWire. */
export function commandsFor(platform: NodeJS.Platform, file: string, volume: number): Command[] {
  switch (platform) {
    case 'darwin':
      return [{ file: 'afplay', args: ['-v', volume.toFixed(2), file] }];
    case 'win32': {
      // SoundPlayer has no volume control. Single quotes are doubled to stay inside the PS literal.
      const literal = `'${file.replace(/'/g, "''")}'`;
      const script = `(New-Object System.Media.SoundPlayer ${literal}).PlaySync()`;
      return [{ file: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command', script] }];
    }
    case 'linux':
    case 'freebsd':
    case 'openbsd':
      return [
        { file: 'paplay', args: [`--volume=${Math.round(volume * 65536)}`, file] },
        { file: 'aplay', args: ['-q', file] },
      ];
    default:
      return [];
  }
}

function listWavs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.wav'))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
