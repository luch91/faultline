import { spawn } from 'node:child_process';
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' };
const api = spawn('node', ['node_modules/wrangler/bin/wrangler.js', 'dev', '--local', '--ip', '127.0.0.1', '--port', '8787', '--var', 'MODEL_CALLS_ENABLED:false', '--var', 'ALLOWED_ORIGIN:http://terminal.local:4173'], { cwd: 'apps/api', env, stdio: 'inherit' });
const web = spawn('node', ['node_modules/vite/bin/vite.js', ...process.argv.slice(2)], { cwd: 'apps/web', env, stdio: 'inherit' });
const stop = () => { api.kill('SIGTERM'); web.kill('SIGTERM'); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
web.on('exit', code => { api.kill('SIGTERM'); process.exit(code ?? 0); });
