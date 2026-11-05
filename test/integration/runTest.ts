import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  // out/test/integration -> repo root
  const repoRoot = path.resolve(__dirname, '../../..');
  // The VS Code launcher splits these arguments on spaces on Windows, so a checkout under a
  // path with spaces is reached through a space-free junction in the temp folder.
  let link: string | undefined;
  let root = repoRoot;
  if (/\s/.test(repoRoot)) {
    link = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pip-it-link-')), 'repo');
    fs.symlinkSync(repoRoot, link, 'junction');
    root = link;
  }
  const extensionDevelopmentPath = root;
  const extensionTestsPath = path.join(root, 'out/test/integration/suite/index');
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'pip-it-ws-'));
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'pip-it-ud-'));
  const extensionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pip-it-ext-'));
  try {
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      extensionTestsEnv: { PIP_TEST: '1' },
      launchArgs: [
        workspace,
        '--disable-extensions',
        '--disable-workspace-trust',
        '--user-data-dir', userData,
        '--extensions-dir', extensionsDir,
      ],
    });
  } finally {
    if (link) { fs.unlinkSync(link); fs.rmSync(path.dirname(link), { recursive: true, force: true }); }
    for (const d of [workspace, userData, extensionsDir]) fs.rmSync(d, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('Integration tests failed:', err);
  process.exit(1);
});
