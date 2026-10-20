// Publish only public files to gh-pages; requires GitHub write access via Git credentials.
import { mkdtemp, cp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const run = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const remote = run(['remote', 'get-url', 'origin']);
const previous = run(['ls-remote', remote, 'refs/heads/gh-pages']).split(/\s/)[0];
const stage = await mkdtemp(path.join(tmpdir(), 'kejian-pages-'));
for (const file of ['index.html', 'assets', 'data', 'materials']) await cp(path.join(root, file), path.join(stage, file), { recursive: true });
await writeFile(path.join(stage, '.nojekyll'), '');
run(['init', '-b', 'gh-pages'], stage);
run(['config', 'user.name', 'runawayaway'], stage);
run(['config', 'user.email', 'runawayaway@users.noreply.github.com'], stage);
run(['add', '.'], stage);
run(['commit', '-m', 'Publish course library'], stage);
run(['remote', 'add', 'origin', remote], stage);
// Refuse to replace a deployment updated by someone else during publication.
console.log(run(['push', `--force-with-lease=refs/heads/gh-pages:${previous}`, 'origin', 'gh-pages'], stage));
console.log('Published public files to gh-pages. Local staging directory: ' + stage);
