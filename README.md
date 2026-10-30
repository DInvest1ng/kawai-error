# Kawaii Error

Расширение VS Code: когда в коде появляется новая ошибка, в нижней панели выпрыгивает
чиби-персонаж и говорит «Хозяин, ошибка!» (или другую фразу из облачка). Персонажа можно выбрать.

Аватар — PNG-спрайты с прозрачным фоном (сгенерированы в Nano Banana). Голос — нейросетевой (Voicebox, Qwen3-TTS), склонирован по голосу из мема.
Подставьте свои ассеты, как описано ниже.

## Быстрый старт

1. Установите `.vsix` (см. [Сборка и установка](#сборка-и-установка)) и перезапустите окно VS Code
   (**Command Palette → «Developer: Reload Window»**).
2. Откройте нижнюю панель (`Ctrl+J` / `Cmd+J`): рядом с Terminal и Problems появится вкладка **Kawaii**.
   Пока ошибок нет, там написано «Kawaii ждёт ошибок…».
3. **Command Palette** (`Cmd+Shift+P` / `Ctrl+Shift+P`) → **«Kawaii: Test reaction»**: девочка выпрыгнет,
   скажет реплику и пискнет.
4. Дальше всё само: допустите ошибку в коде, запустите в терминале `false` или `ls /nope`, уроните программу
   под отладчиком. Между реакциями выдерживается пауза 10 секунд (`kawaiiError.cooldownSeconds`).

Если в терминале не срабатывает — проверьте, что работает shell integration: слева от выполненных
команд должны появляться кружки (синий — успех, красный — ошибка).

## Персонажи

| Персонаж | Реплики | Голос |
|----------|---------|-------|
| **Нацуки** (по умолчанию) | «Хозяин, ошибка!» и др. | да |
| **Курилов** | «Так, ошибка. Разбираемся.», «Кто это написал?!» и др.; на ошибки ещё и злится | нет, бипы |

Сменить: кнопка 👤 в заголовке панели **Kawaii** (или розовая кнопка-сакура в правом верхнем углу
самой панели, или **Command Palette → «Kawaii: Выбрать персонажа»**). Откроется карусель:
листайте стрелками, клавишами ←/→ или колёсиком, **Enter** — выбрать, **Esc** — закрыть.
Новый персонаж сразу поздоровается. Выбор хранится в настройке `kawaiiError.character`.

Добавить своего встроенного персонажа — папка `media/characters/<id>/`:

- `character.json`: `{ "name": "Имя", "phrases": ["…"], "testPhrase": "…", "errorEmotions": ["worried", "surprised", "angry"] }`
  (`errorEmotions` необязателен, по умолчанию `worried` и `surprised`);
- спрайты `idle` (обязателен — он же карточка в карусели), `talk`, `worried`, `surprised`, `happy`, `angry`;
- необязательная озвучка `voice-<номер фразы>.wav` и `voice-test.wav`.

Затем добавьте `<id>` в `enum` настройки `kawaiiError.character` в `package.json`.

## На что реагирует

| Источник     | Когда                                                                 |
|--------------|-----------------------------------------------------------------------|
| Problems     | общее число диагностик уровня Error выросло (уже существующие при старте не считаются) |
| Задачи       | процесс задачи (Tasks) завершился с кодом ≠ 0                        |
| Терминал     | команда в интегрированном терминале завершилась с кодом ≠ 0 (нужна [shell integration](https://code.visualstudio.com/docs/terminal/shell-integration), по умолчанию включена для bash/zsh/fish/pwsh) |
| Отладка      | отладчик остановился на исключении, или программа под отладчиком завершилась с кодом ≠ 0 |

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
| `kawaiiError.character` | `natsuki` | Персонаж: `natsuki` или `kurilov` |
| `kawaiiError.phrases` | `[]` | Свои реплики; пусто — реплики персонажа |
| `kawaiiError.detectors.diagnostics` | `true` | Детектор Problems |
| `kawaiiError.detectors.tasks` | `true` | Детектор задач |
| `kawaiiError.detectors.terminal` | `true` | Детектор терминала |
| `kawaiiError.detectors.debug` | `true` | Детектор исключений отладчика |
| `kawaiiError.diagnostics.onlyOnSave` | `false` | Реагировать на диагностики только после сохранения файла |
| `kawaiiError.terminal.ignoreExitCodes` | `[130]` | Коды выхода, которые не считаются ошибкой (130 — Ctrl+C) |
| `kawaiiError.sound.enabled` | `true` | Звук |
| `kawaiiError.sound.volume` | `70` | Громкость 0–100 |
| `kawaiiError.sound.directory` | `""` | Папка со своими `.wav` |
| `kawaiiError.sprites.directory` | `""` | Папка со своими спрайтами для выбранного персонажа |

## Свои ассеты

### Спрайты

Картинки (`.png`, `.gif`, `.webp` или `.svg`; подойдёт и анимированный GIF):

| Файл        | Когда показывается                          |
|-------------|---------------------------------------------|
| `idle`      | в покое                                     |
| `talk`      | кадр «рот открыт», чередуется с эмоцией, пока печатается реплика |
| `worried`   | ошибка                                      |
| `surprised` | ошибка / предупреждение                     |
| `happy`     | тестовая реакция                            |
| `angry`     | ошибка, если персонаж злится (`errorEmotions`) |

Положите их в любую папку и укажите её в `kawaiiError.sprites.directory`
(например `~/kawaii/sprites/worried.png`): они заменят спрайты выбранного персонажа, недостающие
берутся у него из `media/characters/<id>/`. Можно и просто заменить файлы там перед сборкой `.vsix`.

### Звуки

См. [media/sounds/README.md](media/sounds/README.md): озвучка фраз `voice-0.wav`…`voice-5.wav`,
`voice-test.wav` лежит в папке персонажа (`media/characters/<id>/`), запасные звуки `error*.wav`,
`warning*.wav`, `test*.wav` (для своих фраз и персонажей без голоса) — в `media/sounds/`.
Папка из `kawaiiError.sound.directory` проверяется первой.

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
npm run test:integration  # тесты в настоящем VS Code (скачивается в .vscode-test/)
npm run package   # собрать kawaii-error-0.1.1.vsix
```

Установка `.vsix`:

- из терминала: `code --install-extension kawaii-error-0.1.1.vsix --force`
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
  characters.ts         загрузка пакетов персонажей (media/characters/<id>/character.json)
  audio.ts              системный плеер
  waifuView.ts          WebviewViewProvider (CSP, asWebviewUri, postMessage)
media/                  HTML/CSS/JS вебвью (облачко, карусель), общие звуки
media/characters/       пакеты персонажей: character.json, спрайты, озвучка
scripts/gen-placeholder-wav.mjs   генератор звуков-плейсхолдеров
```

## Лицензия

MIT
