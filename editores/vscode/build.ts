// Empacota a extensão (e o conversor junto) num único dist/extension.js em CommonJS.
import { rmSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
const r = await Bun.build({
  entrypoints: ['src/extension.ts'], outdir: 'dist', target: 'node', format: 'cjs', external: ['vscode'], minify: false,
});
if (!r.success) { console.error(r.logs); process.exit(1); }
console.log('dist/extension.js', (r.outputs[0]!.size / 1024).toFixed(1), 'KB');
