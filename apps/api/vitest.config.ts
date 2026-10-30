import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
export default defineConfig({resolve:{alias:{'cloudflare:workers':fileURLToPath(new URL('./src/tests/cloudflare-stub.ts',import.meta.url))}}});
