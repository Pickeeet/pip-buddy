import * as vscode from 'vscode';
import { EventBus } from './bus';
import { Brain } from './brain/brain';
import { ACHIEVEMENTS } from './brain/achievements';
import { rollover } from './brain/diary';
import { localHour } from './brain/time';
import { readConfig, type PipConfig } from './config';
import { load, save } from './store';
import { registerEditingDetectors } from './detectors/editing';
import { registerFileDetectors } from './detectors/files';
import { registerGitDetectors } from './detectors/git';
import { registerRunDetectors } from './detectors/runs';
import linesJson from './lines/lines.json';
import { PipPanel } from './ui/panel';
import { PipStatusBar } from './ui/statusBar';
import type { StateMessage } from './ui/messages';
import type { Fx, LinePack, Mode, Mood, PipEvent, PipState } from './types';

const lines = linesJson as unknown as LinePack;
const SAVE_DEBOUNCE_MS = 2000;
const ROLLOVER_MS = 60_000;
const MOOD_HOLD_MS = 8000;

let flush: (() => Promise<void>) | undefined;
let testApi: { bus: EventBus; brain: Brain } | undefined;

/** Idle look between remarks: the night cap between 00:00 and 05:00, otherwise unimpressed. */
const restingMood = (now: number): Mood => (localHour(now) <= 4 ? 'NIGHTCAP' : 'UNIMPRESSED');

export function activate(ctx: vscode.ExtensionContext): void {
  const kv = ctx.globalState;
  const rng = Math.random;
  const state: PipState = load(kv, Date.now());
  rollover(state, Date.now(), rng);

  let cfg: PipConfig = readConfig();
  const bus = new EventBus();
  const makeBrain = (): Brain => new Brain(state, lines, { rng, cooldownMs: cfg.cooldownSeconds * 1000 });
  let brain = makeBrain();
  brain.setMode(cfg.mode);

  // What Pip is currently showing (the last remark), separate from persisted state.
  let mood: Mood = restingMood(Date.now());
  let fx: Fx = '';
  let line: string | null = null;
  let moodTimer: ReturnType<typeof setTimeout> | undefined;

  const panel = new PipPanel(ctx.extensionUri);
  const statusBar = new PipStatusBar();
  ctx.subscriptions.push(vscode.window.registerWebviewViewProvider(PipPanel.viewId, panel), statusBar);

  const snapshot = (): StateMessage => ({
    kind: 'state',
    faith: state.faith,
    mood: state.hushed ? 'SULKING' : mood,
    fx: state.hushed ? '' : fx,
    line,
    mode: state.mode,
    hushed: state.hushed,
    diary: [...state.diary],
    achievements: ACHIEVEMENTS.filter((a) => a.id in state.achievements)
      .map((a) => ({ id: a.id, title: a.title, blurb: a.blurb, at: state.achievements[a.id] }))
      .sort((a, b) => a.at - b.at),
  });
  /** Drop the current remark: back to the resting look with an empty bubble. */
  const rest = (): void => {
    if (moodTimer) { clearTimeout(moodTimer); moodTimer = undefined; }
    mood = restingMood(Date.now());
    fx = '';
    line = null;
  };
  const push = (): void => {
    const s = snapshot();
    panel.setState(s);
    statusBar.update(s);
  };

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  flush = async (): Promise<void> => {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = undefined; }
    try {
      await save(kv, state);
    } catch (err) {
      console.error('[pip] save failed', err);
    }
  };
  const scheduleSave = (): void => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void flush?.(); }, SAVE_DEBOUNCE_MS);
  };
  const changed = (): void => { push(); scheduleSave(); };

  ctx.subscriptions.push({ dispose: bus.on((e: PipEvent) => {
    const r = brain.handle(e);
    if (e.type === 'hush') rest(); // the "(Pip has turned around.)" placeholder shows at once
    if (r) {
      mood = r.mood;
      fx = r.fx;
      line = r.text;
      if (moodTimer) clearTimeout(moodTimer);
      moodTimer = setTimeout(() => { moodTimer = undefined; rest(); push(); }, MOOD_HOLD_MS);
      if (cfg.surface === 'toasts') void vscode.window.showInformationMessage(`Pip: ${r.text}`);
    }
    changed();
  }) });

  const getCfg = (): PipConfig => cfg;
  registerEditingDetectors(ctx, bus, getCfg);
  registerRunDetectors(ctx, bus, getCfg);
  registerFileDetectors(ctx, bus, getCfg);
  registerGitDetectors(ctx, bus, getCfg);

  ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
    if (!e.affectsConfiguration('pip')) return;
    const prev = cfg;
    cfg = readConfig();
    if (cfg.cooldownSeconds !== prev.cooldownSeconds) brain = makeBrain();
    if (cfg.mode !== state.mode) brain.setMode(cfg.mode);
    if (testApi) testApi.brain = brain;
    changed();
  }));

  const emit = (type: 'hush' | 'wake'): void => bus.emit({ type, at: Date.now(), data: {} });
  ctx.subscriptions.push(
    vscode.commands.registerCommand('pip.hush', () => emit('hush')),
    vscode.commands.registerCommand('pip.wake', () => emit('wake')),
    vscode.commands.registerCommand('pip.toggleMode', async () => {
      const next: Mode = state.mode === 'dry' ? 'savage' : 'dry';
      brain.setMode(next);
      changed();
      await vscode.workspace.getConfiguration('pip').update('mode', next, vscode.ConfigurationTarget.Global);
    }),
    vscode.commands.registerCommand('pip.showDiary', async () => {
      await vscode.commands.executeCommand('pip.corner.focus');
      panel.showTab('diary');
    }),
    vscode.commands.registerCommand('pip.roastCard', () => {
      void vscode.window.showInformationMessage('Roast Card arrives Friday.');
    }),
    vscode.commands.registerCommand('pip.resetFaith', () => {
      state.faith = 5;
      changed();
    }),
  );

  const tick = setInterval(() => {
    const now = Date.now();
    const wrote = rollover(state, now, rng).length > 0;
    // While no remark is showing, put the night cap on at 00:00 and take it off at 05:00.
    const recapped = !moodTimer && mood !== restingMood(now);
    if (recapped) mood = restingMood(now);
    if (wrote) changed();
    else if (recapped) push();
  }, ROLLOVER_MS);
  ctx.subscriptions.push({ dispose: () => {
    clearInterval(tick);
    if (moodTimer) clearTimeout(moodTimer);
  } });

  testApi = process.env.PIP_TEST === '1' ? { bus, brain } : undefined;
  push();
}

export async function deactivate(): Promise<void> {
  const f = flush;
  flush = undefined;
  testApi = undefined;
  if (f) await f();
}

/** Test hook for the integration suite; only populated when `PIP_TEST=1`. */
export function __testApi(): { bus: EventBus; brain: Brain } | undefined {
  return process.env.PIP_TEST === '1' ? testApi : undefined;
}
