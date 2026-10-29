# Kawaii Error

Расширение VS Code: когда в коде появляется новая ошибка, в нижней панели выпрыгивает
аниме-девочка, говорит «Хозяин, ошибка!» и проигрывает звук.

Вся графика и звуки в репозитории — простые плейсхолдеры (оригинальные SVG и сгенерированные бипы).
Подставьте свои ассеты, как описано ниже.

## На что реагирует

| Источник     | Когда                                                                 |
|--------------|-----------------------------------------------------------------------|
| Problems     | общее число диагностик уровня Error выросло (уже существующие при старте не считаются) |
| Задачи       | процесс задачи (Tasks) завершился с кодом ≠ 0                        |
| Терминал     | команда в интегрированном терминале завершилась с кодом ≠ 0 (нужна [shell integration](https://code.visualstudio.com/docs/terminal/shell-integration), по умолчанию включена для bash/zsh/fish/pwsh) |
| Отладка      | отладчик остановился на исключении (любой тип отладчика)             |

События от всех источников проходят через общую шину: ошибки, пришедшие с интервалом меньше
`debounceMs`, сливаются в одну реакцию, а между реакциями выдерживается пауза `cooldownSeconds`.

Проверить без ошибки: **Command Palette → «Kawaii: Test reaction»**.

Лог всех реакций и проблем со звуком: **Output → Kawaii Error**.

## Настройки

| Настройка | По умолчанию | Описание |
|-----------|--------------|----------|
| `kawaiiError.enabled` | `true` | Включить реакции |
| `kawaiiError.debounceMs` | `1500` | Окно объединения ошибок, мс |
| `kawaiiError.cooldownSeconds` | `10` | Минимальная пауза между реакциями, с |
| `kawaiiError.displayDuration` | `6` | Сколько секунд девочка на экране |
| `kawaiiError.revealPanel` | `true` | Открывать панель Kawaii, если она скрыта (фокус остаётся в редакторе) |
| `kawaiiError.phrases` | `[]` | Свои реплики; пусто — встроенные |
| `kawaiiError.detectors.diagnostics` | `true` | Детектор Problems |
| `kawaiiError.detectors.tasks` | `true` | Детектор задач |
| `kawaiiError.detectors.terminal` | `true` | Детектор терминала |
| `kawaiiError.detectors.debug` | `true` | Детектор исключений отладчика |
| `kawaiiError.diagnostics.onlyOnSave` | `false` | Реагировать на диагностики только после сохранения файла |
| `kawaiiError.terminal.ignoreExitCodes` | `[130]` | Коды выхода, которые не считаются ошибкой (130 — Ctrl+C) |
| `kawaiiError.sound.enabled` | `true` | Звук |
| `kawaiiError.sound.volume` | `70` | Громкость 0–100 |
| `kawaiiError.sound.directory` | `""` | Папка со своими `.wav` |
| `kawaiiError.sprites.directory` | `""` | Папка со своими спрайтами |

## Свои ассеты

### Спрайты

Нужны пять картинок (`.png`, `.gif`, `.webp` или `.svg`; подойдёт и анимированный GIF):

| Файл        | Когда показывается                          |
|-------------|---------------------------------------------|
| `idle`      | в покое                                     |
| `talk`      | кадр «рот открыт», чередуется с эмоцией, пока печатается реплика |
| `worried`   | ошибка                                      |
| `surprised` | ошибка / предупреждение                     |
| `happy`     | тестовая реакция                            |

Положите их в любую папку и укажите её в `kawaiiError.sprites.directory`
(например `~/kawaii/sprites/worried.png`). Недостающие файлы берутся из встроенных `media/sprites/`.
Можно и просто заменить файлы в `media/sprites/` перед сборкой `.vsix`.

### Звуки

См. [media/sounds/README.md](media/sounds/README.md): файлы `error*.wav`, `warning*.wav`, `test*.wav`
в `media/sounds/` или в папке из `kawaiiError.sound.directory`.

Как играется звук:

| ОС      | Плеер | Громкость |
|---------|-------|-----------|
| macOS   | `afplay` | да |
| Linux   | `paplay` (PulseAudio/PipeWire), иначе `aplay` | только с `paplay` |
| Windows | PowerShell `System.Media.SoundPlayer` | нет, системная |

## Сборка и установка

Нужны Node.js 22+ и npm.

```sh
npm install
npm run compile   # проверка типов + eslint + сборка esbuild в dist/
npm test          # unit-тесты шины ошибок и выбора реакций
npm run package   # собрать kawaii-error-0.1.0.vsix
```

Установка `.vsix`:

- из терминала: `code --install-extension kawaii-error-0.1.0.vsix`
  (если команды `code` нет: в VS Code **Command Palette → «Shell Command: Install 'code' command in PATH»**);
- или в VS Code: **Extensions → «…» → Install from VSIX…** и выбрать файл.

После установки панель **Kawaii** появится в нижней панели рядом с Terminal/Problems.

### Разработка

Откройте папку в VS Code и нажмите **F5**: запустится Extension Development Host с `npm run watch`.

```
src/
  extension.ts          связывает детекторы → шину → реакцию → вебвью и звук
  detectors/            источники ошибок (diagnostics, task, terminal, debug)
  errorBus.ts           debounce + cooldown, без зависимости от vscode
  reaction.ts           выбор реплики, эмоции и звука
  audio.ts              системный плеер
  waifuView.ts          WebviewViewProvider (CSP, asWebviewUri, postMessage)
media/                  HTML/CSS/JS вебвью, спрайты, звуки
scripts/gen-placeholder-wav.mjs   генератор звуков-плейсхолдеров
```

## Лицензия

MIT
