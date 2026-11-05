import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// Matches: import x from 'vscode', import * as x from "vscode", export ... from 'vscode',
// import 'vscode', import('vscode'), require('vscode'), import x = require('vscode').
const VSCODE_IMPORT = /\b(?:from|import|require)\s*\(?\s*['"`]vscode['"`]/;

describe('purity: pure modules never import vscode', () => {
  const brainFiles = walk(join(root, 'src', 'brain')).filter((f) => /\.(ts|js)$/.test(f));
  const classifyFiles = walk(join(root, 'src', 'detectors', 'classify')).filter((f) => /\.(ts|js)$/.test(f));
  const files = [...brainFiles, ...classifyFiles];

  it('the vscode import matcher catches every import form', () => {
    const bad = [
      "import * as vscode from 'vscode';",
      'import { window } from "vscode"',
      "export { window } from 'vscode';",
      "import 'vscode';",
      "const v = await import('vscode');",
      "const v = require('vscode');",
      "import v = require('vscode');",
    ];
    for (const s of bad) expect(VSCODE_IMPORT.test(s), s).toBe(true);
    expect(VSCODE_IMPORT.test("import x from './vscodeish';")).toBe(false);
  });

  it('scans at least one file under src/brain (not vacuous)', () => {
    expect(brainFiles.length).toBeGreaterThan(0);
  });

  it('has no vscode import in src/brain or src/detectors/classify', () => {
    const offenders = files.filter((f) => VSCODE_IMPORT.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
