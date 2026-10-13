// Lance l'API (Wikipédia simulé par défaut) et le serveur de développement Vite ensemble.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = { ...process.env, PORT: '3001', DATA_DIR: process.env.DATA_DIR || './data-dev', WIKI_MOCK: process.env.WIKI_MOCK ?? '1' };
const children = [
  spawn(process.execPath, ['--no-warnings=ExperimentalWarning', '--watch', 'server/index.js'], { cwd: root, env, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { cwd: root, env: { ...process.env, API_PORT: '3001' }, stdio: 'inherit' }),
];
const stop = () => {
  for (const c of children) c.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const c of children) c.on('exit', stop);
