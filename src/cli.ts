#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ARQUITETURAS, APELIDOS } from './asm/arquiteturas.ts';
import { acharFerramenta, type Config } from './asm/montador.ts';
import { ehErroFonte } from './erros.ts';
import { definirIdioma, idioma, msg, type Idioma } from './mensagens.ts';
import { montar } from './montar.ts';
import { FORMATOS, formatar, mapa, type Formato } from './saida.ts';

function main(argv: string[]): number {
	// --lang vem antes de tudo, para que até os erros de argumentos saiam no idioma pedido
	const k = argv.indexOf('--lang');
	if (k >= 0) {
		const v = argv[k + 1];
		if (v === undefined) throw new Error(msg().precisaValor('--lang'));
		definirIdioma(v.toLowerCase().slice(0, 2) as Idioma);
		argv = [...argv.slice(0, k), ...argv.slice(k + 2)];
	}

	const pos: string[] = [];
	const op: Record<string, string | true> = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i]!;
		const comValor = (nome: string) => { const v = argv[++i]; if (v === undefined) throw new Error(msg().precisaValor(a)); op[nome] = v; };
		if (a === '-o' || a === '--out') comValor('out');
		else if (a === '-f' || a === '--format') comValor('format');
		else if (a === '--mime') comValor('mime');
		else if (a === '--config') comValor('config');
		else if (a === '--map') op.map = true;
		else if (a === '--base64') op.format = 'datauri';					 // compatibilidade com a versão JS
		else if (a === '--arquiteturas' || a === '--architectures') op.arquiteturas = true;
		else if (a === '-h' || a === '--help') op.help = true;
		else if (a.startsWith('-') && a !== '-') throw new Error(msg().opcaoDesconhecida(a));
		else pos.push(a);
	}

	const ajuda = msg().ajuda(FORMATOS.join(' | '));
	if (op.help) { process.stdout.write(ajuda); return 0; }
	if (op.arquiteturas) {
		const ap = (n: string) => Object.entries(APELIDOS).filter(([, v]) => v === n).map(([k]) => k);
		for (const [n, a] of Object.entries(ARQUITETURAS)) {
			const al = ap(n);
			const descricao = idioma() === 'pt' ? a.descricao : a.description;
			console.log(`	${n.padEnd(14)} ${descricao}${al.length ? `	${msg().tambem(al.join(', '))}` : ''}`);
		}
		console.log(`\n	llvm-mc: ${acharFerramenta('llvm-mc', 'LLVM_MC') ?? msg().naoEncontrado()}`);
		console.log(`	ld.lld:	${acharFerramenta('ld.lld', 'LD_LLD') ?? msg().naoEncontrado()}`);
		return 0;
	}

	const [entrada, saidaPos] = pos;
	if (!entrada) { process.stderr.write(ajuda); return 1; }
	const saida = (op.out as string | undefined) ?? saidaPos;
	const formato = (op.format as Formato | undefined) ?? 'bin';
	if (!FORMATOS.includes(formato)) throw new Error(msg().formatoDesconhecido(formato));

	let config: Config | undefined;
	const arqConfig = (op.config as string | undefined) ?? join(dirname(entrada), 'txt2bin.config.json');
	if (existsSync(arqConfig)) config = JSON.parse(readFileSync(arqConfig, 'utf8'));
	else if (op.config) throw new Error(msg().configNaoEncontrada(arqConfig));

	const fonte = readFileSync(entrada, 'utf8');
	let r;
	try {
		r = montar(fonte, { config });
	} catch (e) {
		if (ehErroFonte(e)) { process.stderr.write(`${msg().erro()}: ${e.formatar(entrada)}\n`); return 1; }
		throw e;
	}

	const dados = formatar(r.bytes, formato, op.mime as string | undefined);
	if (saida && saida !== '-') {
		writeFileSync(saida, dados);
		process.stderr.write(`${saida}: ${r.bytes.length} bytes\n`);
	} else if (saida === '-' || formato !== 'bin') {
		process.stdout.write(dados);
	} else if (!op.map) {
		throw new Error(msg().informeSaida());
	}
	if (op.map) process.stderr.write(mapa(r) + '\n');
	return 0;
}

try {
	process.exitCode = main(process.argv.slice(2));
} catch (e) {
	process.stderr.write(`${msg().erro()}: ${(e as Error).message}\n`);
	process.exitCode = 1;
}
