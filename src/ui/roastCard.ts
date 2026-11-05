import * as vscode from 'vscode';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildCard } from '../brain/roastCard';
import type { PipState } from '../types';
import type { PipPanel } from './panel';
import { decodePngDataUrl } from './pngData';

const READY_TIMEOUT_MS = 10_000;
const RENDER_TIMEOUT_MS = 10_000;
const RETRY_MS = 1500;

let pending: ((dataUrl: string) => void) | undefined;

/** Wired as the panel's `cardPng` handler. */
export function handleCardPng(dataUrl: string): void {
  const resolve = pending;
  pending = undefined;
  resolve?.(dataUrl);
}

async function renderPng(panel: PipPanel, state: PipState): Promise<string | null> {
  // The view must be on screen: a collapsed sidebar drops the webview's content.
  await vscode.commands.executeCommand('pip.corner.focus');
  if (!(await panel.whenReady(READY_TIMEOUT_MS))) return null;
  const card = buildCard(state, Date.now());
  return new Promise<string | null>((resolve) => {
    let retry: ReturnType<typeof setInterval> | undefined;
    let giveUp: ReturnType<typeof setTimeout> | undefined;
    const done = (v: string | null): void => {
      if (retry) clearInterval(retry);
      if (giveUp) clearTimeout(giveUp);
      pending = undefined;
      resolve(v);
    };
    pending = (url) => done(url);
    giveUp = setTimeout(() => done(null), RENDER_TIMEOUT_MS);
    panel.renderCard(card);
    // The webview may have been reloading when the first message went out.
    retry = setInterval(() => panel.renderCard(card), RETRY_MS);
  });
}

function defaultSaveUri(name: string): vscode.Uri {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
  return folder ? vscode.Uri.joinPath(folder, name) : vscode.Uri.file(join(homedir(), name));
}

/** `Pip: Make Roast Card`: render in the webview, then offer Save PNG and Copy path. */
export async function makeRoastCard(panel: PipPanel, state: PipState): Promise<void> {
  const weekOf = buildCard(state, Date.now()).weekOf;
  const dataUrl = await renderPng(panel, state);
  if (dataUrl === null) {
    void vscode.window.showInformationMessage('Pip refuses to pose without the panel open.');
    return;
  }
  const bytes = decodePngDataUrl(dataUrl);
  if (!bytes) {
    void vscode.window.showErrorMessage('Pip could not produce a card. It blames you.');
    return;
  }
  const pick = await vscode.window.showInformationMessage('Pip has prepared your weekly roast.', 'Save PNG…');
  if (pick !== 'Save PNG…') return;
  const target = await vscode.window.showSaveDialog({
    defaultUri: defaultSaveUri(`pip-roast-${weekOf}.png`),
    filters: { 'PNG image': ['png'] },
    saveLabel: 'Save Roast Card',
  });
  if (!target) return;
  try {
    await vscode.workspace.fs.writeFile(target, bytes);
  } catch (err) {
    void vscode.window.showErrorMessage(`Pip could not save the card: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  const next = await vscode.window.showInformationMessage(`Saved ${target.fsPath}`, 'Copy path');
  if (next === 'Copy path') await vscode.env.clipboard.writeText(target.fsPath);
}
