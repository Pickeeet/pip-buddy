# Pip — design spec (2026-11-05)

## Context
`Pip a teasing partner.html` is a design mockup: a fake "Pixel Buddy IDE" with a 16×12 pixel sprite (Pip) that deadpans about *your habits* — pasting, mass deletes, `console.log` #3, typing at 23:47, idling, failed/passing runs — plus a Faith Meter, Dry/Savage modes, "Pip: Hush", and a "Pip's Diary" tab. Rules in the sheet: habits not identity, deadpan only (praise only as disbelief), 3.5 s cooldown, never blocks typing.

Decisions made with the user: **VS Code extension** (also works in Cursor/Windsurf/VSCodium via Open VSX), **pure habit humour — no AI-code targeting**, goal is a **shippable MVP** on the Marketplace + Open VSX.

## The idea, sharpened: Pip has a memory
A one-liner generator is a toy you mute on day 3. What makes a character something you keep around is **continuity**, and that's the surprise here. Pip remembers, holds grudges, builds running jokes, and has one well-hidden soft spot.

1. **Grudges and callbacks.** Pip keeps a ledger of repeat offences and brings them back later: *"`temp2.ts`. Again. That's four this week. I've started a support group."* Callbacks can span days: *"Last Tuesday you swore you'd write tests. I wrote it down."*
2. **Pip's Diary.** Pip writes a passive-aggressive end-of-day entry from the day's events: *"Day 41. Human deleted 600 lines, then typed them back. Called it 'refactoring'. I said nothing. I'm growing."* It's readable in the panel's Diary tab, and this is what keeps people opening the panel.
3. **Backhanded achievements.** *"Friday Deployer: committed at 17:58 on a Friday. Brave."* *"Archaeologist: opened a file untouched for 2 years."* *"Commitment Issues: 5 commits titled 'fix'."*
4. **Bribes (a light Tamagotchi).** Good habits feed Pip and refill the Faith Meter, grudgingly: writing a test, a real commit message, a clean run after failures. Pip never says thank you: *"...fine. One block. Don't make it weird."*
5. **Sulking.** Hush Pip and it sulks with its back turned. Waking it gets: *"Oh, NOW you need me."* Hushing three times in a day earns a diary entry about it.
6. **The Crack (the emotional hook).** Very rarely (after a long red→green debugging struggle, at most once a week) Pip drops the act for exactly one line: *"...okay. That was actually good."* Then it instantly recovers: *"Forget I said that."* This is the moment people screenshot.
7. **Night shift.** After midnight Pip wears a nightcap sprite, yawns, and its nagging gets sleepier and more pointed the later it gets.
8. **Weekly Roast Card (growth loop).** On Fridays Pip renders a shareable pixel-art PNG: top offences, Faith Meter trend, the best diary line, the achievement of the week, and whether The Crack happened. One click copies or saves it. It's Spotify Wrapped for coding habits, and it's how Pip spreads.

Privacy is a selling point: **100% local, no network, no telemetry**. Pip only counts events and never stores or sends your code.

## What Pip detects (all via stable VS Code APIs)
| Habit | API / heuristic |
|---|---|
| Big paste | `workspace.onDidChangeTextDocument`: one change with inserted text ≥ 200 chars (setting `pip.pasteThreshold`) that matches `env.clipboard.readText()` |
| Mass delete | change with `rangeLength ≥ 15` and empty text |
| Undo spam | `TextDocumentChangeEvent.reason === Undo`, counted in a window |
| Typing frenzy | 14+ changes in 2 s |
| `console.log` / `print(` / `debugger` added | regex on inserted text, running count per day |
| Late night | first keystroke after 23:00 (once per night) |
| Idle → return | no edits for 15 s+, comment on return |
| Run fail/pass | `tasks.onDidEndTaskProcess` exitCode + `window.onDidEndTerminalShellExecution` exitCode (shell integration) |
| Test written | file created or saved matching `*.test.*`, `*_test.*`, `test_*.py` |
| Bad file names | `workspace.onDidCreateFiles` / `onDidRenameFiles`, matching `final|v\d|REAL|copy|temp|new` |
| Commit messages | `vscode.git` extension API: repository state change → latest commit message (`fix`, `asdf`, `wip`, `.`) |
| Save spam | `onDidSaveTextDocument` frequency |
| Ancient file | `fs.stat` mtime on open (≥ 1 yr) |

## Architecture (`pip/` folder inside the working directory)
Small units, each with one job, connected by a typed event bus:

- `src/extension.ts`: activation; wires the detectors, brain, UI and commands.
- `src/detectors/*.ts`: one file per habit family (editing, runs, files, git, time). Each only emits a `PipEvent` (`{type, data, at}`) and holds no humour logic.
- `src/brain/`, pure TypeScript with no `vscode` import, so it can be unit-tested:
  - `mood.ts`: mood state machine (UNIMPRESSED, RECKLESS, APPALLED, SLEEPY, SMUG, DEAD, SULKING, NIGHTCAP, CRACKED), mapped to sprite, animation and effects.
  - `faith.ts`: 10-block Faith Meter; drains on bad habits, refills on bribes.
  - `speaker.ts`: chooses a line. Applies the 3.5 s cooldown, Dry/Savage tier, no repeats in the last N lines, and the rarity budget (The Crack: weekly cap, plus the struggle precondition).
  - `memory.ts`: grudge ledger (offence counts per day/week), callback selection, achievement unlocks.
  - `diary.ts`: builds the end-of-day entry from templates plus the day's stats.
- `src/lines/*.json`: curated line packs per event, with `dry`/`savage` variants and templates (`{count}`, `{time}`, `{file}`, `{streak}`). Seeded from the mockup's lines (for example "It runs?! Quick, screenshot it before you touch it again."). Aim for 8–15 lines per event so Pip doesn't repeat itself.
- `src/store.ts`: persists faith, stats, grudges, diary and achievements in `ExtensionContext.globalState`, with a schema version.
- `src/ui/panel.ts` + `media/panel.{html,js,css}`: webview view in the sidebar with Pip's Corner (sprite, speech bubble, Faith Meter), plus Diary and Achievements tabs. It ports the mockup's sprite system: the `BASE` / `EYES` / `MOUTH` grids, palette, `steps()` animation, and fire/sweat/zzz/confetti/RIP effects. CSP-locked, no remote assets; fonts (VT323, JetBrains Mono, OFL) are bundled with their licence.
- `src/ui/statusBar.ts`: tiny mood glyph plus a truncated latest line; click to open the panel. Optional toast mode for people who keep the panel closed.
- `src/roastCard.ts` + webview canvas: renders the weekly PNG, then save dialog or copy to clipboard.
- Commands: `Pip: Hush` / `Pip: Wake`, `Pip: Toggle Dry/Savage`, `Pip: Show Diary`, `Pip: Make Roast Card`, `Pip: Reset Faith`.
- Settings: `pip.mode` (dry|savage), `pip.cooldownSeconds`, `pip.lateNightHour`, `pip.surface` (panel|statusbar|toasts), per-detector toggles.

Never block typing: all handlers are O(changes), debounced, and do no heavy work on the keystroke path.

## Build order
1. Scaffold the extension (TypeScript, esbuild bundle, vitest, `@vscode/test-electron`). Port the sprite renderer into the webview and confirm it animates in the Extension Development Host (F5).
2. Event bus plus editing detectors (paste, delete, frenzy, undo, console.log, idle, late night). Brain v1: mood, speaker with cooldown, line packs.
3. Runs, files and git detectors; Faith Meter, bribes, status bar.
4. Memory: grudges, callbacks, achievements; diary generation; Hush/sulk; nightcap; The Crack.
5. Weekly Roast Card.
6. Ship prep: icon, README with GIFs, CHANGELOG, licence, `vsce package`. Publishing to the Marketplace and Open VSX needs the user's own publisher accounts and tokens, which the user enters. Check that the name "Pip" is free before packaging, with "Pixel Buddy" as fallback.

Status: design approved in conversation 2026-11-05; awaiting written-spec review before the implementation plan is written.

## Verification
- **Unit (vitest):** brain modules with a fake clock. Cooldown respected; Dry vs Savage chosen; no repeats; the Crack fires only after the struggle precondition and at most once a week; faith bounds 0–10; diary built from a given day's stats; achievement unlocks.
- **Integration (`@vscode/test-electron`):** open a temp workspace and simulate a large paste, a bulk delete, a task that fails with exit 1 then passes, and creating `utils_final_v3.ts`. Assert that the right `PipEvent`s and mood changes happen.
- **Manual:** F5 into the Extension Development Host and go through every reaction-sheet trigger. Check that typing never lags (Developer: Show Running Extensions shows activation and CPU time), that Hush/Wake work, and that the Roast Card PNG saves and copies.
- **Package:** `vsce package` installs cleanly from the `.vsix` in VS Code and in one fork (Cursor or VSCodium).
