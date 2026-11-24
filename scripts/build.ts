// Gera dist/ para publicar no npm: roda em Node ≥ 18 e em Bun.
import { chmodSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
const r = await Bun.build({ entrypoints: ['src/cli.ts', 'src/index.ts'], outdir: 'dist', target: 'node', format: 'esm', splitting: true });
if (!r.success) { console.error(r.logs); process.exit(1); }

// O CLI fonte usa "#!/usr/bin/env bun"; o empacotado roda em Node.
const cli = readFileSync('dist/cli.js', 'utf8').replace(/^#!.*\n(\/\/ @bun\n)?/, '');
writeFileSync('dist/cli.js', '#!/usr/bin/env node\n' + cli);
chmodSync('dist/cli.js', 0o755);
for (const s of r.outputs) console.log(`  ${s.path.replace(process.cwd() + '/', '')}  ${(s.size / 1024).toFixed(1)} KB`);
