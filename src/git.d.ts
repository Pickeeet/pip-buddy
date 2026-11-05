// Minimal hand-written subset of the VS Code git extension API (v1).
// Mirrors the shapes in extensions/git/src/api/git.d.ts of https://github.com/microsoft/vscode
// (not copied verbatim: only the members Pip uses are declared).
import type { Event, Uri } from 'vscode';

export interface Commit {
  readonly hash: string;
  readonly message: string;
  readonly commitDate?: Date;
}

export interface Branch {
  readonly name?: string;
  readonly commit?: string;
}

export interface RepositoryState {
  readonly HEAD: Branch | undefined;
  readonly onDidChange: Event<void>;
}

export interface Repository {
  readonly rootUri: Uri;
  readonly state: RepositoryState;
  getCommit(ref: string): Promise<Commit>;
}

export interface API {
  readonly repositories: Repository[];
  readonly onDidOpenRepository: Event<Repository>;
}

export interface GitExtension {
  getAPI(version: 1): API;
}
