# Pip

Pip is a 16×12 pixel sprite who lives in your sidebar and is deeply unimpressed by your coding habits.

<!-- GIFs go here before publishing (record into media/gifs/ and uncomment):
![Pip noticing a paste](media/gifs/paste.gif)
![Pip's faith in you, going down](media/gifs/faith.gif)
![A Roast Card](media/gifs/roast-card.gif)
-->

## What Pip notices

Pip judges habits, never people. It has opinions about what you did, not who you are.

| Habit | What Pip notices |
| --- | --- |
| Paste | A big chunk of text lands in one go (200+ characters by default). |
| Mass delete | You wipe out a large selection in one keystroke. |
| Undo spam | Five undos in three seconds. |
| Typing frenzy | A burst of 14 edits in two seconds. |
| `console.log` / `print` | Debug prints appearing, and how many. |
| Late night | Editing after 23:00 (configurable). After midnight Pip wears a night cap. |
| Coming back | You return after 15 seconds of silence. |
| Failed runs | A task, or a build/test/run command in the terminal (`npm`, `pytest`, `cargo`...), exits non-zero, and keeps doing it. `cd`, `ls` and `git` are not runs. |
| Passing runs | A run finally passes. Pip is surprised. |
| Tests | You save a test file. Pip does not trust it, but notes it. |
| Cursed file names | `utils_final_v3_REAL.ts` and its relatives. |
| Commits | Lazy messages like `fix` or `wip`; good ones too, grudgingly. |
| Save spam | Five saves in ten seconds. |
| Ancient files | You open something untouched for a year or more. |

Every habit can be switched off individually in `pip.detectors`.

## Privacy

**Pip reads your edits and clipboard momentarily to classify them, and stores only counts, file names and commit subjects — never your code. No network calls, no telemetry.**

Everything lives in VS Code's own extension storage on your machine. Your code is never stored, and nothing leaves your computer. Fonts are bundled, so even the webview makes no requests.

## Commands

| Command | What it does |
| --- | --- |
| `Pip: Hush` | Pip turns around and sulks. |
| `Pip: Wake` | Pip turns back. It will mention this. |
| `Pip: Toggle Dry/Savage` | Switch between deadpan and less polite. |
| `Pip: Show Diary` | Opens Pip's Corner on the diary tab. |
| `Pip: Make Roast Card` | A shareable card of your week's offences. |
| `Pip: Reset Faith` | Puts Pip's faith in you back to 5. Generous of it. |

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `pip.mode` | `dry` | `dry` is deadpan; `savage` is less polite. |
| `pip.cooldownSeconds` | `3.5` | Minimum seconds between remarks. |
| `pip.pasteThreshold` | `200` | Characters in one paste before Pip notices. |
| `pip.lateNightHour` | `23` | Hour (0-23) from which Pip considers it late. |
| `pip.surface` | `panel` | `panel` or `toasts` (remarks also pop up as notifications). |
| `pip.detectors` | all on | Per-habit on/off switches. |

## Meet Pip's memory

Pip remembers, and it is not discreet about it.

- **Grudges.** Do the same thing often enough in a week and Pip stops treating it as an accident and starts keeping count.
- **A diary.** Each day gets one entry, written at midnight, once. Open it with `Pip: Show Diary`.
- **Achievements.** There are a few. Praise only ever arrives as disbelief.
- **Sulking.** Hush Pip and it turns its back. Waking it up has consequences.
- **The Crack.** After a long, miserable streak of failures, a pass may get a reaction you don't see from Pip any other day. It happens rarely. You will know.

Pip's Faith Meter runs from 0 to 10 and starts at 5. You can see it in Pip's Corner.

## Licence

MIT. Bundled fonts (VT323, JetBrains Mono) are under the SIL Open Font License; see `media/fonts/OFL.txt`.
