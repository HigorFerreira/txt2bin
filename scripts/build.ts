// Gera dist/ para publicar no npm: roda em Node ≥ 18 e em Bun.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

rmSync('dist', { recursive: true, force: true });
const r = await Bun.build({ entrypoints: ['src/cli.ts', 'src/index.ts'], outdir: 'dist', target: 'node', format: 'esm', splitting: true });
if (!r.success) { console.error(r.logs); process.exit(1); }

// O CLI fonte usa "#!/usr/bin/env bun"; o empacotado roda em Node.
const cli = readFileSync('dist/cli.js', 'utf8').replace(/^#!.*\n(\/\/ @bun\n)?/, '');
writeFileSync('dist/cli.js', '#!/usr/bin/env node\n' + cli);
chmodSync('dist/cli.js', 0o755);
for (const s of r.outputs) console.log(`  ${s.path.replace(process.cwd() + '/', '')}  ${(s.size / 1024).toFixed(1)} KB`);

// Conferência do pacote: o CLI empacotado, no Node, troca o idioma do conversor inteiro.
// O bun build duplica módulos no pacote; se o estado do idioma deixar de ser
// compartilhado (ver mensagens.ts), o --lang muda só a cópia do CLI e isto falha.
const dir = mkdtempSync(join(tmpdir(), 'txt2bin-build-'));
try {
	const arq = join(dir, 'erro.ttb');
	writeFileSync(arq, '<<uint8\n$nada\n');
	const conferir = (idioma: string, esperado: string) => {
		const s = spawnSync('node', ['dist/cli.js', '--lang', idioma, arq, '-o', '-'], { encoding: 'utf8' });
		if (s.error) { console.warn(`  (Node não encontrado; conferência pulada: ${s.error.message})`); return; }
		if (!s.stderr.includes(esperado)) {
			console.error(`dist/cli.js com --lang ${idioma} deveria dizer "${esperado}", mas disse:\n${s.stderr}`);
			process.exit(1);
		}
	};
	conferir('en', 'undefined label "$nada"');
	conferir('pt', 'rótulo indefinido "$nada"');
	console.log('  conferência do CLI no Node: ok (pt e en)');
} finally {
	rmSync(dir, { recursive: true, force: true });
}
