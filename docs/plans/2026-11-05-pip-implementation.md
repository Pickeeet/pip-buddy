# Pip VS Code Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A publishable VS Code extension in which Pip, a sarcastic 16×12 pixel sprite, reacts to your editing habits, remembers them (grudges, diary, achievements, The Crack) and renders a weekly shareable Roast Card.

**Architecture:** Thin `vscode` adapters (detectors, UI, store) around a pure-TypeScript `brain/` that turns `PipEvent`s into `Remark`s and state changes. Detectors delegate to pure classifier functions, so almost all logic is unit-testable without VS Code. A sidebar webview renders the sprite ported from the mockup.

**Tech Stack:** TypeScript (strict), esbuild, vitest, `@vscode/test-electron` + mocha, `@vscode/vsce`, `ovsx`.

**Spec:** `pip/docs/specs/2026-11-05-pip-design.md`. Design source: `Pip a teasing partner.html` (bundled mockup; sprite grids, palette and seed lines are copied from it).

## Global Constraints
- `engines.vscode`: `^1.93.0` (needed for `window.onDidEndTerminalShellExecution`).
- 100% local: no network calls, no telemetry, no code text persisted. Only counts, file *basenames* and commit messages are stored.
- `src/brain/**` and `src/detectors/classify/**` must not import `vscode` (enforced by a vitest test that greps the imports).
- Voice: habits not identity; deadpan only; praise only arrives as disbelief; no hearts or "you got this".
- Cooldown between remarks: 3.5 s (`pip.cooldownSeconds`, default `3.5`).
- Faith Meter: integer 0–10, starts at 5.
- Thresholds (defaults): paste ≥ 200 chars (`pip.pasteThreshold`); mass delete `rangeLength ≥ 15`; frenzy = 14 changes in 2000 ms; idle = 15 s; late night from hour 23 (`pip.lateNightHour`); night cap from 00:00 to 05:00; undo spam = 5 undos in 3000 ms; save spam = 5 saves in 10 s; ancient file = mtime ≥ 365 days ago.
- The Crack: at most once per 7 days, and only on a `runPass` that follows a fail streak of ≥ 3 spanning ≥ 10 minutes.
- Never block typing: the `onDidChangeTextDocument` handler does O(number of changes) work and no awaits before classifying.
- Fonts VT323 and JetBrains Mono bundled under `media/fonts/` with their OFL text.

## Review Focus
1. **Programmatic edits misread as habits** (format-on-save, git checkout, search-and-replace across files, extensions editing documents): only classify changes to the document of the *active text editor*, with scheme `file` or `untitled`, and skip events where `contentChanges.length > 50`. Test in Task 8.
2. **Day rollover while VS Code stays open past midnight:** the diary for the previous day is written exactly once and today's stats start empty. Test in Task 6.
3. **Corrupt or older persisted state:** activation never throws; unknown schema → fresh state, keeping faith if it's a valid number. Test in Task 7.
4. **Two VS Code windows sharing `globalState`:** diary entries are keyed by date, so a day appears once even if both windows write. Test in Task 7.
5. **Large multi-cursor or huge-file edits:** one event with many changes yields at most one remark, and classification stays bounded. Test in Task 8.

---

## Shared types (`src/types.ts`, created in Task 1, used everywhere)

```ts
export type PipEventType =
  | 'paste' | 'massDelete' | 'undoSpam' | 'frenzy' | 'debugPrint' | 'lateNight'
  | 'idleReturn' | 'runFail' | 'runPass' | 'testWritten' | 'badFileName'
  | 'commitLazy' | 'commitGood' | 'saveSpam' | 'ancientFile' | 'hush' | 'wake';
export interface PipEvent { type: PipEventType; at: number; data: Record<string, string | number> }
export type Mode = 'dry' | 'savage';
export type Mood = 'UNIMPRESSED' | 'RECKLESS' | 'APPALLED' | 'SLEEPY' | 'SMUG' | 'DEAD' | 'SULKING' | 'NIGHTCAP' | 'CRACKED';
export type Fx = '' | 'fire' | 'sweat' | 'zzz' | 'smoke' | 'confetti' | 'question';
export type RemarkKind = 'line' | 'callback' | 'achievement' | 'crack' | 'bribe' | 'diary';
export interface Remark { text: string; mood: Mood; fx: Fx; kind: RemarkKind; event: PipEventType; at: number }
export interface DayStats {
  counts: Partial<Record<PipEventType, number>>; hushes: number;
  badNames: string[]; commitMsgs: string[]; failStreak: number; failStreakStart: number;
  maxFailStreak: number; crack: boolean; faithMin: number; faithMax: number;
}
export interface DiaryEntry { date: string; dayNumber: number; text: string }
export interface PipState {
  schema: 1; faith: number; mode: Mode; hushed: boolean; firstSeen: number;
  days: Record<string, DayStats>;           // key = local date 'YYYY-MM-DD'; keep last 28
  achievements: Record<string, number>;     // id -> unlocked-at ms
  diary: DiaryEntry[];                      // unique by date, newest last, keep last 60
  lastCrackAt: number; recent: string[];    // last 20 line ids spoken
}
export interface LinePack { [event: string]: { dry: string[]; savage: string[] } }
```

`localDate(ms: number): string` lives in `src/brain/time.ts` (Task 2) and is the only day-key function.

---

### Task 1: Scaffold, types, event bus

**Files:**
- Create: `pip/package.json`, `pip/tsconfig.json`, `pip/esbuild.mjs`, `pip/vitest.config.ts`, `pip/.vscodeignore`, `pip/.gitignore`, `pip/.vscode/launch.json`, `pip/src/types.ts`, `pip/src/bus.ts`, `pip/src/extension.ts`
- Test: `pip/test/unit/bus.test.ts`, `pip/test/unit/purity.test.ts`

**Interfaces:**
- Produces: all types above; `class EventBus { on(fn: (e: PipEvent) => void): () => void; emit(e: PipEvent): void }`; `activate(ctx)` / `deactivate()` (stub that registers nothing yet).

- [ ] **Step 1:** `git init` in `pip/`. Write `package.json`: name `pip-buddy`, displayName `Pip — your sarcastic pixel buddy`, publisher placeholder `TODO-publisher` (replaced in Task 12), `main: ./dist/extension.js`, engines as in Global Constraints, `activationEvents: ["onStartupFinished"]`, scripts `build` (esbuild), `watch`, `test:unit` (vitest run), `test:int`, `package` (vsce package). Dev deps: typescript, esbuild, vitest, @types/vscode@1.93, @types/node, @vscode/test-electron, mocha, @types/mocha, @vscode/vsce, ovsx.
- [ ] **Step 2: Failing tests.** `bus.test.ts`: `emit` calls every subscriber with the same event; the unsubscribe function returned by `on` stops delivery; a throwing subscriber doesn't stop the others. `purity.test.ts`: no file under `src/brain` or `src/detectors/classify` contains `from 'vscode'`.
- [ ] **Step 3:** Run `npm run test:unit`. Expected: FAIL (bus missing).
- [ ] **Step 4:** Implement `EventBus` (catches subscriber errors with `console.error`) and the types file.
- [ ] **Step 5:** Run `npm run test:unit && npm run build`. Expected: PASS, and `dist/extension.js` exists.
- [ ] **Step 6:** Commit `chore: scaffold pip extension with types and event bus`.

### Task 2: Line packs and the speaker

**Files:**
- Create: `pip/src/lines/lines.json`, `pip/src/brain/time.ts`, `pip/src/brain/speaker.ts`
- Test: `pip/test/unit/speaker.test.ts`, `pip/test/unit/lines.test.ts`

**Interfaces:**
- Produces: `localDate(ms: number): string`; `localHour(ms: number): number`; `fill(template: string, data: Record<string,string|number>): string` (unknown `{key}` left as-is); `class Speaker { constructor(lines: LinePack, rng: () => number, cooldownMs: number); pick(event: PipEventType, mode: Mode, data, at: number, recent: string[]): { id: string; text: string } | null; canSpeak(at: number): boolean; markSpoken(at: number): void }`. Line id = `${event}.${mode}.${index}`.

- [ ] **Step 1: Write `lines.json`** with keys for every `PipEventType` except `hush`/`wake`, plus `bribe`, `callback`, `wakeSulk`, `crack`, `crackRecover`. 8–15 lines per mode for the main events, ≥ 4 for the others. Seed these exact mockup lines (mode in brackets):
  - `runFail` [dry]: "Broken. Shocking. Nobody saw this coming. Except me. I saw it."
  - `runPass` [dry]: "It runs?! Quick, screenshot it before you touch it again."
  - `frenzy` [dry]: "Wow, look at you go. Typing faster than you think. Literally."
  - `massDelete` [dry]: "{count} characters, gone. Bold of you to assume you'll remember why."
  - `debugPrint` [dry]: "console.log #{count}. A debugger exists, but sure, do it your way."
  - `lateNight` [dry]: "It's {time}. Normal people are asleep. You're here. Writing bugs."
  - `idleReturn` [dry]: "...zzz... wake me when you remember you have a job..."
  - `badFileName` [dry]: "{file}. Sure. That one's definitely the last one."
  - `wakeSulk`: "Oh, NOW you need me."
  - `crack`: "...okay. That was actually good."  `crackRecover`: "Forget I said that."
  - `bribe` [dry]: "...fine. One block. Don't make it weird."
  - Savage variants are the same joke with a full sigh. Templates may use `{count}`, `{time}`, `{file}`, `{streak}`, `{msg}`.
- [ ] **Step 2: Failing tests.** `lines.test.ts`: every event key has non-empty `dry` and `savage` arrays; no line contains "you got this", "❤" or "proud of you". `speaker.test.ts`: `fill('{count} gone', {count: 214})` → `'214 gone'`; `canSpeak` is false 3499 ms after `markSpoken` and true at 3500; `pick` with `mode='savage'` returns a savage line; `pick` never returns an id in `recent` when another exists; it returns a repeat only when all lines are in `recent`.
- [ ] **Step 3:** Run `npx vitest run test/unit/speaker.test.ts test/unit/lines.test.ts`. Expected: FAIL.
- [ ] **Step 4:** Implement `time.ts` and `speaker.ts` (uniform choice among non-recent candidates using `rng`).
- [ ] **Step 5:** Run again. Expected: PASS. Commit `feat(brain): line packs and speaker with cooldown`.

### Task 3: Faith Meter and mood mapping

**Files:**
- Create: `pip/src/brain/faith.ts`, `pip/src/brain/mood.ts`
- Test: `pip/test/unit/faith.test.ts`, `pip/test/unit/mood.test.ts`

**Interfaces:**
- Produces: `FAITH_DELTA: Partial<Record<PipEventType, number>>`; `applyFaith(faith: number, e: PipEventType): number` (clamped 0–10); `moodFor(e: PipEventType, hour: number, hushed: boolean): { mood: Mood; fx: Fx }`.

- [ ] **Step 1: Failing tests.** Deltas: `runFail −1`, `massDelete −1`, `paste −1`, `debugPrint −1` (the brain applies it only when `data.count % 3 === 0`), `commitLazy −1`, `badFileName −1`, `runPass +1`, `testWritten +1`, `commitGood +1`, everything else 0. Clamping: `applyFaith(0,'runFail') === 0`, `applyFaith(10,'runPass') === 10`. Mood table: `frenzy → RECKLESS/fire`, `massDelete → APPALLED/sweat`, `runFail → DEAD/smoke`, `runPass → SMUG/confetti`, `idleReturn → SLEEPY/zzz`, `badFileName → UNIMPRESSED/question`, others `UNIMPRESSED/''`; `hushed=true` → `SULKING/''`; hour 0–4 with mood UNIMPRESSED → `NIGHTCAP/zzz`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(brain): faith meter and mood mapping`.

### Task 4: Memory — grudges, callbacks, achievements

**Files:**
- Create: `pip/src/brain/memory.ts`, `pip/src/brain/achievements.ts`
- Test: `pip/test/unit/memory.test.ts`, `pip/test/unit/achievements.test.ts`

**Interfaces:**
- Consumes: `PipState`, `DayStats`, `localDate`.
- Produces: `emptyDay(): DayStats`; `record(state: PipState, e: PipEvent): DayStats` (mutates and returns today's stats, prunes days older than 28); `weekCount(state, type, at): number` (last 7 local days); `callbackFor(state, e, at): string | null` returns a filled callback line when `weekCount ≥ 3` for the same type, at most one callback per type per day; `ACHIEVEMENTS: { id: string; title: string; blurb: string; test: (state: PipState, e: PipEvent) => boolean }[]`; `unlockNew(state, e): typeof ACHIEVEMENTS[number][]`.

- [ ] **Step 1: Failing tests.** `record` increments `counts[type]`, appends `data.file` to `badNames` and `data.msg` to `commitMsgs`, and on `runFail` increments `failStreak` (setting `failStreakStart` when going 0→1). `runPass` resets the streak after updating `maxFailStreak`. With 3 `badFileName` events on different days in one week, `callbackFor` returns text containing `4` on the 4th (it uses `{count}` = weekCount). A second call the same day returns null. Achievements (ids and exact titles): `friday-deployer` "Friday Deployer" (commit on Friday at hour ≥ 17); `archaeologist` "Archaeologist" (`ancientFile`); `commitment-issues` "Commitment Issues" (5 `commitLazy` in a week); `night-owl` "Nocturnal" (3 `lateNight` days in a week); `copy-pasta` "Copy Pasta" (10 pastes in a day); `phoenix` "Phoenix" (`runPass` after `maxFailStreak ≥ 5`). Each unlocks once only.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(brain): grudges, callbacks and achievements`.

### Task 5: Brain facade — hush, sulk, The Crack

**Files:**
- Create: `pip/src/brain/brain.ts`, `pip/src/brain/initialState.ts`
- Test: `pip/test/unit/brain.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces: `initialState(now: number): PipState`; `class Brain { constructor(state: PipState, lines: LinePack, opts: { rng: () => number; cooldownMs: number }); handle(e: PipEvent): Remark | null; setMode(m: Mode): void; readonly state: PipState }`.

`handle` order: record → faith → achievements → special cases → speak. Special cases: `hush` sets `hushed`, increments `hushes`, returns null. `wake` clears `hushed` and returns the `wakeSulk` line, ignoring cooldown. While hushed, every other event still records and updates faith but returns null. The Crack (when its condition in Global Constraints holds on `runPass`) returns `kind:'crack'`, mood `CRACKED`, text `crack + ' ' + crackRecover`, and sets `lastCrackAt` and `day.crack`. An achievement unlock beats a callback, a callback beats a line, and a faith increase from a bribe event returns a `bribe` line. Cooldown applies to everything except `wake` and `crack`.

- [ ] **Step 1: Failing tests** (fake clock via `e.at`, `rng = () => 0`): two events 1 s apart → second returns null; hush → `frenzy` returns null but `counts.frenzy === 1`; wake → text `"Oh, NOW you need me."`; three `runFail` over 11 min then `runPass` → `kind === 'crack'`; repeat the same sequence 2 days later → not crack; 8 days later → crack again; 2 fails then pass → not crack; first `ancientFile` → `kind === 'achievement'`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(brain): brain facade with hush, sulk and the crack`.

### Task 6: Diary

**Files:**
- Create: `pip/src/brain/diary.ts`
- Test: `pip/test/unit/diary.test.ts`

**Interfaces:**
- Produces: `writeDiary(state: PipState, date: string, rng): DiaryEntry | null` (null if no stats for that date or an entry already exists); `rollover(state: PipState, now: number, rng): DiaryEntry[]` writes entries for every past date in `days` with no diary entry, at most 1 per date.

Entry text: `"Day {dayNumber}. "` + 2–3 sentences chosen from templates keyed on the day's top two counts (`massDelete`, `paste`, `runFail`, `lateNight`, `badFileName`, `commitLazy`, `debugPrint`) + a closer from `["I said nothing. I'm growing.", "I'm fine.", "Tomorrow will be worse. I can feel it."]`. If `hushes ≥ 3`: "Was told to hush {n} times. Noted. Permanently." If `crack`: "Something happened today. We don't talk about it." `dayNumber` = days since `firstSeen` + 1.

- [ ] **Step 1: Failing tests:** an entry for a day with 5 `massDelete` mentions "deleted"; `writeDiary` twice for the same date → second null; `rollover` at 00:05 with stats for yesterday → exactly 1 entry, and calling it again → 0; `hushes: 3` → contains "hush"; `dayNumber` is 41 when `firstSeen` is 40 days earlier.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS. **Step 5:** Commit `feat(brain): pip's diary`.

### Task 7: Store

**Files:**
- Create: `pip/src/store.ts`
- Test: `pip/test/unit/store.test.ts`

**Interfaces:**
- Produces: `interface KV { get<T>(k: string): T | undefined; update(k: string, v: unknown): Thenable<void> }` (matches `vscode.Memento`); `load(kv: KV, now: number): PipState`; `save(kv: KV, s: PipState): Promise<void>` (debounced by the caller, Task 10); `merge(a: PipState, b: PipState): PipState` (diary union by date, achievements min unlock time, days max per count).

- [ ] **Step 1: Failing tests:** `load` of undefined → `initialState`; `load` of `{schema: 99, faith: 7}` → fresh state with faith 7; `load` of `"garbage"` → fresh state, no throw; `merge` of two states each holding a diary entry for `2026-11-05` → one entry.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement (key `pip.state`; `save` re-reads, merges, then writes). **Step 4:** Run. Expected: PASS. **Step 5:** Commit `feat: persisted state with migration and merge`.

### Task 8: Editing detectors

**Files:**
- Create: `pip/src/detectors/classify/editing.ts`, `pip/src/detectors/editing.ts`
- Test: `pip/test/unit/classify-editing.test.ts`

**Interfaces:**
- Produces (pure): `interface Change { text: string; rangeLength: number }`; `classifyChanges(changes: Change[], ctx: { clipboard: string; pasteThreshold: number; isUndo: boolean }): PipEventType[]` (≤ 1 of each type, `[]` if `changes.length > 50`); `countDebugPrints(text: string): number` (matches `console.log(`, `print(`, `debugger`, `println!(`, `fmt.Println(`); `class RateWindow { constructor(n: number, ms: number); hit(at: number): boolean }` (true once when the nth hit lands within `ms`, then resets); `class IdleTracker { constructor(idleMs: number); touch(at: number): boolean }` (true when the previous touch was ≥ idleMs ago); `lateNightOnce(at: number, lastFired: string | null, hour: number): boolean`.
- Produces (adapter): `registerEditingDetectors(ctx: vscode.ExtensionContext, bus: EventBus, cfg: () => PipConfig): void`. `PipConfig` is defined in `src/config.ts` in this task: `{ mode, cooldownSeconds, pasteThreshold, lateNightHour, surface, detectors: Record<string, boolean> }`.

The adapter uses Review Focus #1's filter. The clipboard is read once per change event, only when some change has `text.length ≥ pasteThreshold`. Debug-print totals per day come from the brain's counts; the adapter emits `debugPrint` with `data.count` equal to its own per-day counter.

- [ ] **Step 1: Failing tests:** a 250-char change equal to the clipboard → `['paste']`; a 250-char change not equal to the clipboard → `[]`; `{text:'', rangeLength: 214}` → `['massDelete']`; 51 changes → `[]`; 3 changes each 250 chars equal to the clipboard (multi-cursor) → `['paste']` once; `countDebugPrints('console.log(a); console.log(b)') === 2`; `RateWindow(14, 2000)` true on the 14th hit at 1999 ms, false at 2001 ms; `IdleTracker(15000)` true after a 15 s gap; `lateNightOnce` true at 23:47 when `lastFired` is yesterday, false when it's today.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement both files. **Step 4:** Run unit tests + `npm run build`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(detectors): editing habits`.

### Task 9: Runs, files, git and save detectors

**Files:**
- Create: `pip/src/detectors/classify/files.ts`, `pip/src/detectors/classify/git.ts`, `pip/src/detectors/runs.ts`, `pip/src/detectors/files.ts`, `pip/src/detectors/git.ts`, `pip/src/git.d.ts` (copied from the VS Code repo's `extensions/git/src/api/git.d.ts`)
- Test: `pip/test/unit/classify-files.test.ts`, `pip/test/unit/classify-git.test.ts`

**Interfaces:**
- Produces (pure): `isBadFileName(basename: string): boolean` (regex `/(final|_v\d+|REAL|copy|temp\d*|new\d*|old)\b/i` on the stem); `isTestFile(basename: string): boolean` (`*.test.*`, `*.spec.*`, `*_test.*`, `test_*.py`); `isAncient(mtimeMs: number, now: number): boolean`; `classifyCommit(msg: string): 'commitLazy' | 'commitGood'` (lazy if trimmed length < 8 or matches `/^(fix|wip|asdf+|update|changes|stuff|\.+|final)$/i`).
- Produces (adapters): `registerRunDetectors`, `registerFileDetectors`, `registerGitDetectors`, same signature as Task 8. Runs: `tasks.onDidEndTaskProcess` and `window.onDidEndTerminalShellExecution`; exitCode 0 → `runPass`, > 0 → `runFail`, undefined → ignore. Git: get the `vscode.git` extension API v1; on each repository's `state.onDidChange`, when `HEAD.commit` changes, `repository.getCommit(sha)` → `classifyCommit(message)` with `data.msg` = first line, truncated to 60 chars. If the git extension is missing, register nothing. Saves: a `RateWindow(5, 10000)` emits `saveSpam`; a save of a test file emits `testWritten` once per file per day. Open: `workspace.fs.stat` → `ancientFile` once per file per day.

- [ ] **Step 1: Failing tests:** `isBadFileName('utils_final_v3_REAL.ts')` true, `isBadFileName('cart.ts')` false, `isBadFileName('newsletter.ts')` false; `isTestFile('cart.test.ts')` and `isTestFile('test_cart.py')` true; `classifyCommit('fix')` lazy, `classifyCommit('Add cart totals rounding')` good, `classifyCommit('...')` lazy; `isAncient(now - 366*864e5, now)` true.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run unit tests + build. Expected: PASS. **Step 5:** Commit `feat(detectors): runs, files, git, saves`.

### Task 10: Panel, sprite, status bar, commands, settings

**Files:**
- Create: `pip/src/ui/panel.ts`, `pip/src/ui/statusBar.ts`, `pip/src/ui/messages.ts`, `pip/media/panel.html`, `pip/media/panel.js`, `pip/media/panel.css`, `pip/media/sprite.js`, `pip/media/fonts/*` (+ `OFL.txt`)
- Modify: `pip/package.json` (contributes), `pip/src/extension.ts`
- Test: `pip/test/unit/sprite.test.ts`

**Interfaces:**
- Consumes: Brain, store, detectors, `PipConfig`.
- Produces: `messages.ts` with `type ToWebview = { kind: 'state'; faith: number; mood: Mood; fx: Fx; line: string | null; mode: Mode; hushed: boolean; diary: DiaryEntry[]; achievements: { id: string; title: string; blurb: string; at: number }[] } | { kind: 'renderCard'; card: RoastCardData }` and `type FromWebview = { kind: 'ready' } | { kind: 'cardPng'; dataUrl: string } | { kind: 'command'; id: string }`. `sprite.js` exports (UMD-style, also requireable by vitest) `spriteGrid(eyes, mouth, body): string[][]` (16×12 colour grid). It uses the mockup's `BASE`, `EYES`, `MOUTH` grids and palette (outline `#1B1530`, highlight `#EFFFF5`, cheeks `#FF8FB1`, body `#6EE7A8` default, `#FFB547` reckless). Mood → (eyes, mouth, body): UNIMPRESSED (side, flat), RECKLESS (side, smirk, #FFB547), APPALLED (shock, open), SLEEPY (sleep, flat), SMUG (happy, smirk), DEAD (dead, frown), SULKING (body-only back view: all eye/mouth rows filled with body colour), NIGHTCAP (sleep, flat, plus a 3-row cap overlay), CRACKED (normal, smile).

`package.json` contributes:
- a view container `pip` in the activity bar with webview view `pip.corner`;
- commands `pip.hush` "Pip: Hush", `pip.wake` "Pip: Wake", `pip.toggleMode` "Pip: Toggle Dry/Savage", `pip.showDiary` "Pip: Show Diary", `pip.roastCard` "Pip: Make Roast Card", `pip.resetFaith` "Pip: Reset Faith";
- configuration for every `PipConfig` key with the defaults in Global Constraints (`pip.surface` enum `panel|statusbar|toasts`, default `panel`).

`extension.ts` wiring: load state → `rollover` → Brain → register detectors → `bus.on(e => brain.handle(e))` → push the state to the panel and status bar → save debounced to 2 s. A 60 s interval calls `rollover`. In `toasts` mode, remarks show via `showInformationMessage`.

The webview has a strict CSP (`default-src 'none'; img-src ${cspSource} data:; style-src ${cspSource}; font-src ${cspSource}; script-src 'nonce-…'`). Layout: Pip's Corner (sprite at 8 px cells with a `steps(2)` bob, speech bubble, 10-block Faith Meter, fx overlays) and tabs for Diary and Achievements. Use the mockup palette: background `#0F0E17`, text `#E6E3FF`, accent `#6EE7A8`.

- [ ] **Step 1: Failing test** `sprite.test.ts`: `spriteGrid('side','flat','#6EE7A8')` is 12 rows × 16 cols, row 0 col 0 is `transparent`, and row 4 equals the mockup's `EYES.side[0]` mapped through the palette.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement `sprite.js`, then the panel, status bar, commands and wiring.
- [ ] **Step 4:** Run unit tests + build. Then F5 the Extension Development Host. Expected: Pip appears in the activity bar and bobs; pasting 300 chars from the clipboard shows a paste line and drops faith by one block; `Pip: Hush` turns Pip around; `Pip: Wake` says "Oh, NOW you need me."
- [ ] **Step 5:** Commit `feat(ui): pip's corner, status bar, commands and settings`.

### Task 11: Weekly Roast Card

**Files:**
- Create: `pip/src/brain/roastCard.ts`, `pip/src/ui/roastCard.ts`, `pip/media/card.js`
- Test: `pip/test/unit/roastCard.test.ts`

**Interfaces:**
- Produces: `interface RoastCardData { weekOf: string; topOffences: { label: string; count: number }[]; faithStart: number; faithEnd: number; diaryLine: string | null; achievement: string | null; cracked: boolean; dayCount: number }`; `buildCard(state: PipState, now: number): RoastCardData` (last 7 local days; top 3 offences by count, using labels from a fixed map such as `paste → "Pastes"`, `massDelete → "Mass deletions"`, `runFail → "Failed runs"`, `lateNight → "Late nights"`, `badFileName → "Cursed file names"`, `commitLazy → "Lazy commits"`, `debugPrint → "console.logs"`); `ui/roastCard.ts` `makeRoastCard(): Promise<void>` sends `renderCard`, receives `cardPng`, then offers "Save PNG…" (`showSaveDialog`, `workspace.fs.writeFile`) and "Copy path". `card.js` draws a 1200×630 canvas: pixel Pip, a title "PIP'S WEEKLY ROAST", the offences, a faith bar, the diary quote, the achievement, and the footer "{cracked ? 'Pip cracked this week. It denies everything.' : 'Pip remained unimpressed.'}". On Fridays from 16:00, the first time the panel opens that day, a status bar notification offers the card (once per week).

- [ ] **Step 1: Failing tests:** `buildCard` on a state with 12 pastes and 3 runFails → `topOffences[0]` is `{label:'Pastes', count:12}`; `cracked` is true when any day in the window has `crack`; `diaryLine` is the newest entry's text in the window, or null.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run unit tests + build; F5 → `Pip: Make Roast Card` saves a 1200×630 PNG that opens in an image viewer. **Step 5:** Commit `feat: weekly roast card`.

### Task 12: Integration tests and ship prep

**Files:**
- Create: `pip/test/integration/runTest.ts`, `pip/test/integration/suite/index.ts`, `pip/test/integration/suite/pip.test.ts`, `pip/README.md`, `pip/CHANGELOG.md`, `pip/LICENSE` (MIT), `pip/media/icon.png` (128×128 Pip, rendered from `spriteGrid` via a small node script `scripts/icon.mjs`)
- Modify: `pip/package.json` (publisher, icon, repository, keywords, categories `Other`, `galleryBanner`), `pip/src/extension.ts` (export `__testApi` returning `{ bus, brain }` when `PIP_TEST=1`)

- [ ] **Step 1: Integration test** (`pip.test.ts`, with `PIP_TEST=1`): open an untitled doc and set the clipboard to 300 chars, then insert it with `editor.edit` → `brain.state.days[today].counts.paste === 1`. Delete 200 chars → `massDelete` counted. Run a shell task `exit 1`, then `exit 0`, → `runFail` then `runPass` counted. Create `utils_final_v3.ts` with `workspace.fs` + `WorkspaceEdit.createFile` → `badFileName` counted. A format-like edit to a non-active document → no events.
- [ ] **Step 2:** Run `npm run test:int`. Expected: PASS (fix anything that fails before continuing).
- [ ] **Step 3:** Check the name: search the Marketplace and Open VSX for "pip-buddy" / "Pip". If taken, rename to `pixel-buddy` / "Pixel Buddy". Ask the user for their publisher id and set `publisher`.
- [ ] **Step 4:** Write the README (hook line, GIF placeholders recorded by the user, the habit table, a privacy section "100% local", settings, commands) and CHANGELOG `0.1.0`.
- [ ] **Step 5:** `npm run build && npx vsce package`. Expected: `pip-buddy-0.1.0.vsix`. Install it with `code --install-extension` and in one fork (Cursor or VSCodium), and do a smoke test.
- [ ] **Step 6:** Commit `chore: integration tests and v0.1.0 packaging`. Publishing (`vsce publish`, `ovsx publish`) is done by the user with their own tokens.
