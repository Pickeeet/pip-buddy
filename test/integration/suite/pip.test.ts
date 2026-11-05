import * as assert from 'assert';
import * as vscode from 'vscode';
import type { PipEvent, PipEventType } from '../../../src/types';
import { localDate } from '../../../src/brain/time';

interface TestApi {
  bus: { on(fn: (e: PipEvent) => void): () => void };
  brain: { state: { days: Record<string, { counts: Partial<Record<PipEventType, number>> }> } };
}

const POLL_MS = 25;
const MAX_WAIT_MS = 5000;

async function until(what: string, cond: () => boolean): Promise<void> {
  const end = Date.now() + MAX_WAIT_MS;
  while (Date.now() < end) {
    if (cond()) return;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  assert.fail(`timed out waiting for ${what}`);
}

async function api(): Promise<TestApi> {
  const ext = vscode.extensions.getExtension('pip-buddy.pip-buddy');
  assert.ok(ext, 'extension not found');
  const a = (await ext.activate()) as TestApi | undefined; // activate() returns __testApi()
  assert.ok(a, 'test api unavailable (PIP_TEST=1 set?)');
  return a;
}

suite('Pip integration', () => {
  let t: TestApi;
  const seen: PipEvent[] = [];
  let off: (() => void) | undefined;

  const count = (type: PipEventType): number => t.brain.state.days[localDate(Date.now())]?.counts[type] ?? 0;

  suiteSetup(async () => {
    t = await api();
    off = t.bus.on((e) => seen.push(e));
  });
  suiteTeardown(() => off?.());

  test('paste of 300 chars matching the clipboard counts as paste', async () => {
    const doc = await vscode.workspace.openTextDocument({ content: '', language: 'plaintext' });
    const editor = await vscode.window.showTextDocument(doc);
    const text = 'x'.repeat(300);
    await vscode.env.clipboard.writeText(text);
    const before = count('paste');
    await editor.edit((b) => b.insert(new vscode.Position(0, 0), text));
    await until('paste counted', () => count('paste') === before + 1);
  });

  test('deleting 200 chars counts as massDelete', async () => {
    const doc = await vscode.workspace.openTextDocument({ content: 'z'.repeat(300), language: 'plaintext' });
    const editor = await vscode.window.showTextDocument(doc);
    const before = count('massDelete');
    await editor.edit((b) => b.delete(new vscode.Range(0, 0, 0, 200)));
    await until('massDelete counted', () => count('massDelete') === before + 1);
  });

  test('a failing then a passing shell task count as runFail then runPass', async () => {
    const run = async (cmd: string): Promise<void> => {
      const task = new vscode.Task(
        { type: 'pip-test' }, vscode.TaskScope.Workspace, cmd, 'pip-test', new vscode.ShellExecution(cmd));
      const ended = new Promise<void>((resolve) => {
        const d = vscode.tasks.onDidEndTaskProcess((e) => {
          if (e.execution.task.name === cmd) { d.dispose(); resolve(); }
        });
      });
      await vscode.tasks.executeTask(task);
      await Promise.race([
        ended,
        new Promise<void>((_, rej) => setTimeout(() => rej(new Error(`task "${cmd}" did not end`)), 15000)),
      ]);
    };
    const fails = count('runFail');
    const passes = count('runPass');
    await run('exit 1');
    await until('runFail counted', () => count('runFail') === fails + 1);
    await run('exit 0');
    await until('runPass counted', () => count('runPass') === passes + 1);
    const types = seen.map((e) => e.type);
    assert.ok(types.lastIndexOf('runFail') < types.lastIndexOf('runPass'), 'runFail should precede runPass');
  });

  test('creating utils_final_v3.ts counts as badFileName', async () => {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri;
    assert.ok(root, 'no workspace folder');
    const dir = vscode.Uri.joinPath(root, 'src');
    await vscode.workspace.fs.createDirectory(dir);
    const before = count('badFileName');
    const we = new vscode.WorkspaceEdit();
    we.createFile(vscode.Uri.joinPath(dir, 'utils_final_v3.ts'), { ignoreIfExists: true });
    assert.ok(await vscode.workspace.applyEdit(we));
    await until('badFileName counted', () => count('badFileName') === before + 1);
    assert.ok(seen.some((e) => e.type === 'badFileName' && e.data.file === 'utils_final_v3.ts'));
  });

  test('a format-like edit to a non-active document emits nothing', async () => {
    const active = await vscode.workspace.openTextDocument({ content: 'active', language: 'plaintext' });
    await vscode.window.showTextDocument(active);
    // The other document holds 300 chars; the edit replaces 250 of them with 300 chars that equal the
    // clipboard and deletes 40 more, so both paste and massDelete would fire if the active-document guard were missing.
    const other = await vscode.workspace.openTextDocument({ content: 'a'.repeat(300), language: 'plaintext' });
    const inserted = 'y'.repeat(300);
    await vscode.env.clipboard.writeText(inserted);
    const mark = seen.length;
    const we = new vscode.WorkspaceEdit();
    we.replace(other.uri, new vscode.Range(0, 0, 0, 250), inserted);
    we.delete(other.uri, new vscode.Range(0, 260, 0, 300));
    assert.ok(await vscode.workspace.applyEdit(we));
    // Negative assertion: nothing to poll for, so give the event pipeline a bounded grace period.
    await new Promise((r) => setTimeout(r, 600));
    assert.deepStrictEqual(seen.slice(mark).map((e) => e.type), []);
  });
});
