import * as vscode from 'vscode';
import { readFileSync } from 'node:fs';
import type { FromWebview, StateMessage, ToWebview } from './messages';
import type { RoastCardData } from '../brain/roastCard';

const ALLOWED_COMMANDS = new Set(['pip.hush', 'pip.wake', 'pip.toggleMode', 'pip.roastCard', 'pip.resetFaith']);

function nonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

/** Webview view `pip.corner`. Holds the latest state so it can re-post on `ready` and on becoming visible. */
export class PipPanel implements vscode.WebviewViewProvider {
  static readonly viewId = 'pip.corner';
  private view: vscode.WebviewView | undefined;
  private ready = false;
  private latest: StateMessage | undefined;
  private pendingTab: Extract<ToWebview, { kind: 'showTab' }>['tab'] | undefined;

  constructor(private readonly extensionUri: vscode.Uri, private readonly onCardPng: (dataUrl: string) => void = () => {}, private readonly onShown: () => void = () => {}) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    this.ready = false;
    const media = vscode.Uri.joinPath(this.extensionUri, 'media');
    view.webview.options = { enableScripts: true, localResourceRoots: [media] };
    view.webview.html = this.html(view.webview, media);

    view.webview.onDidReceiveMessage((m: FromWebview) => this.receive(m));
    view.onDidChangeVisibility(() => {
      // A hidden webview loses its content; its script says `ready` again when shown.
      if (!view.visible) { this.ready = false; return; }
      this.onShown();
    });
    this.onShown();
    view.onDidDispose(() => {
      if (this.view === view) { this.view = undefined; this.ready = false; }
    });
  }

  setState(s: StateMessage): void {
    this.latest = s;
    this.post(s);
  }

  showTab(tab: Extract<ToWebview, { kind: 'showTab' }>['tab']): void {
    if (this.view && this.ready) this.post({ kind: 'showTab', tab });
    else this.pendingTab = tab;
  }

  /** True once the webview has been resolved and has said `ready`. */
  isReady(): boolean { return this.view !== undefined && this.ready; }

  /** Resolves true when the webview is ready, false after `timeoutMs`. */
  whenReady(timeoutMs: number): Promise<boolean> {
    if (this.isReady()) return Promise.resolve(true);
    return new Promise((resolve) => {
      const started = Date.now();
      const poll = setInterval(() => {
        if (this.isReady()) { clearInterval(poll); resolve(true); }
        else if (Date.now() - started >= timeoutMs) { clearInterval(poll); resolve(false); }
      }, 100);
    });
  }

  renderCard(card: RoastCardData): void { this.post({ kind: 'renderCard', card }); }

  private post(m: ToWebview): void {
    if (this.view && this.ready) void this.view.webview.postMessage(m);
  }

  private receive(m: FromWebview): void {
    if (!m || typeof m !== 'object') return;
    if (m.kind === 'ready') {
      this.ready = true;
      if (this.latest) this.post(this.latest);
      if (this.pendingTab) { this.post({ kind: 'showTab', tab: this.pendingTab }); this.pendingTab = undefined; }
    } else if (m.kind === 'command' && ALLOWED_COMMANDS.has(m.id)) {
      void vscode.commands.executeCommand(m.id);
    } else if (m.kind === 'cardPng' && typeof m.dataUrl === 'string') {
      this.onCardPng(m.dataUrl);
    }
  }

  private html(webview: vscode.Webview, media: vscode.Uri): string {
    const n = nonce();
    const uri = (f: string): string => webview.asWebviewUri(vscode.Uri.joinPath(media, f)).toString();
    const template = readFileSync(vscode.Uri.joinPath(media, 'panel.html').fsPath, 'utf8');
    const csp = `default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${n}'`;
    return template
      .replace(/\{\{csp\}\}/g, csp)
      .replace(/\{\{nonce\}\}/g, n)
      .replace(/\{\{cssUri\}\}/g, uri('panel.css'))
      .replace(/\{\{spriteUri\}\}/g, uri('sprite.js'))
      .replace(/\{\{cardUri\}\}/g, uri('card.js'))
      .replace(/\{\{jsUri\}\}/g, uri('panel.js'));
  }
}
