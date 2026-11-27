// Packs the library, installs the tarball into each example app, builds them for production,
// and runs the smoke test against each one. Production builds, because tree-shaking bugs
// (like a wrong `sideEffects`) only show up there.
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs';

const APPS = ['lit', 'vue', 'react19', 'react18', 'react19-wrapper', 'react19-ssr', 'node'];
const PACK_DIR = 'examples/.pack';

function run(command, cwd = '.') {
  console.log(`\n> ${command}${cwd === '.' ? '' : `  (in ${cwd})`}`);
  execSync(command, { stdio: 'inherit', cwd });
}

try {
  run('pnpm build');

  rmSync(PACK_DIR, { recursive: true, force: true });
  mkdirSync(PACK_DIR);
  run(`pnpm pack --pack-destination ${PACK_DIR}`);
  const tarballs = readdirSync(PACK_DIR).filter((f) => f.endsWith('.tgz'));
  if (tarballs.length !== 1) throw new Error(`Expected one tarball in ${PACK_DIR}, found ${tarballs.length}`);
  // A fixed name, so the examples' package.json never has to change with the version
  renameSync(`${PACK_DIR}/${tarballs[0]}`, `${PACK_DIR}/consistent-date-picker.tgz`);

  for (const app of APPS) {
    const dir = `examples/${app}`;
    // A clean install every time, so the app can't keep an older copy of the tarball
    rmSync(`${dir}/node_modules`, { recursive: true, force: true });
    run('pnpm install --no-lockfile', dir);
    // Apps written in TypeScript also check the package's types, like `consistent-date-picker/vue`
    const { scripts = {} } = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'));
    if (scripts.typecheck) run('pnpm typecheck', dir);
    // `check` is for apps with no page to test, like the Node one
    if (scripts.check) run('pnpm check', dir);
    if (scripts.build) run('pnpm build', dir);
  }

  run('pnpm exec playwright test -c examples/playwright.config.ts');
} catch (err) {
  console.error(`\ntest:consumers failed: ${err.message}`);
  process.exit(1);
}
