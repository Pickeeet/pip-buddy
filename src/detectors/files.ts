import * as vscode from 'vscode';
import type { EventBus } from '../bus';
import type { PipConfig } from '../config';
import { localDate } from '../brain/time';
import { RateWindow } from './classify/editing';
import { isAncient, isBadFileName, isTestFile, OncePerDay } from './classify/files';

const baseName = (uri: vscode.Uri): string => uri.path.split('/').pop() ?? '';

export function registerFileDetectors(
  ctx: vscode.ExtensionContext, bus: EventBus, cfg: () => PipConfig,
): void {
  const saves = new RateWindow(5, 10000);
  const testDay = new OncePerDay();
  const ancientDay = new OncePerDay();
  const badDay = new OncePerDay();
  const on = (k: string): boolean => cfg().detectors[k] !== false;

  const checkName = (uri: vscode.Uri): void => {
    if (uri.scheme !== 'file' || !on('badFileName')) return;
    const file = baseName(uri);
    const at = Date.now();
    if (isBadFileName(file) && badDay.first(uri.toString(), localDate(at))) {
      bus.emit({ type: 'badFileName', at, data: { file } });
    }
  };

  ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument((doc) => {
    if (doc.uri.scheme !== 'file') return;
    const at = Date.now();
    // Auto-save would saveSpam on its own; only manual saves count.
    const manual = vscode.workspace.getConfiguration('files').get<string>('autoSave') === 'off';
    if (manual && on('saveSpam') && saves.hit(at)) bus.emit({ type: 'saveSpam', at, data: { count: 5 } });
    const file = baseName(doc.uri);
    if (on('testWritten') && isTestFile(file) && testDay.first(doc.uri.toString(), localDate(at))) {
      bus.emit({ type: 'testWritten', at, data: {} });
    }
    checkName(doc.uri);
  }));

  ctx.subscriptions.push(vscode.workspace.onDidCreateFiles((e) => { for (const f of e.files) checkName(f); }));
  // Rename checks the new name.
  ctx.subscriptions.push(vscode.workspace.onDidRenameFiles((e) => { for (const f of e.files) checkName(f.newUri); }));

  // Ancient files: checked when the user brings an editor to the front, not for every document
  // an extension or search happens to load.
  const checkAncient = (editor: vscode.TextEditor | undefined): void => {
    const uri = editor?.document.uri;
    if (!uri || uri.scheme !== 'file' || !on('ancientFile')) return;
    const at = Date.now();
    if (!ancientDay.first(uri.toString(), localDate(at))) return;
    const file = baseName(uri);
    void Promise.resolve(vscode.workspace.fs.stat(uri)).then((st) => {
      if (isAncient(st.mtime, Date.now())) bus.emit({ type: 'ancientFile', at: Date.now(), data: { file } });
    }, () => { /* unreadable: no event */ });
  };
  ctx.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(checkAncient));
  checkAncient(vscode.window.activeTextEditor);
}
