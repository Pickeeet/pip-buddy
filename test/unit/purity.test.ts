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

describe('purity: pure modules never import vscode', () => {
  const files = [
    ...walk(join(root, 'src', 'brain')),
    ...walk(join(root, 'src', 'detectors', 'classify')),
  ].filter((f) => /\.(ts|js)$/.test(f));

  it('has no vscode import in src/brain or src/detectors/classify', () => {
    const offenders = files.filter((f) => /from\s+['"]vscode['"]|require\(\s*['"]vscode['"]\s*\)/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
