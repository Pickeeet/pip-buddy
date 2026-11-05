import * as vscode from 'vscode';
import type { EventBus } from '../bus';
import type { PipConfig } from '../config';
import type { API, GitExtension, Repository } from '../git';
import { classifyMessage, firstLine, HeadTracker, isFreshCommit } from './classify/git';

export function registerGitDetectors(
  ctx: vscode.ExtensionContext, bus: EventBus, cfg: () => PipConfig,
): void {
  const ext = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!ext) return;

  void (async () => {
    let api: API;
    try {
      const exports = ext.isActive ? ext.exports : await ext.activate();
      api = exports.getAPI(1);
    } catch {
      return; // git unavailable or disabled: Pip stays quiet
    }

    const heads = new HeadTracker();
    let n = 0;

    const watch = (repo: Repository): void => {
      const key = `${n++}:${repo.rootUri.toString()}`;
      heads.changed(key, repo.state.HEAD?.commit); // remember the existing HEAD without counting it
      ctx.subscriptions.push(repo.state.onDidChange(() => {
        const sha = repo.state.HEAD?.commit;
        if (!heads.changed(key, sha) || !sha) return;
        if (cfg().detectors.commits === false) return;
        void Promise.resolve(repo.getCommit(sha)).then((c) => {
          const at = Date.now();
          if (!isFreshCommit(c.commitDate, at)) return; // checkout / pull, not a commit
          bus.emit({ type: classifyMessage(c.message), at, data: { msg: firstLine(c.message) } });
        }, () => { /* commit unreadable: no event */ });
      }));
    };

    try {
      for (const r of api.repositories) watch(r);
      ctx.subscriptions.push(api.onDidOpenRepository(watch));
    } catch { /* never throw into activation */ }
  })();
}
