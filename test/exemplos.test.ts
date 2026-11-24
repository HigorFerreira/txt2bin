import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { montar } from '../src/index.ts';
import { acharFerramenta } from '../src/asm/montador.ts';

const dir = join(import.meta.dir, '..', 'exemplos');
const sha = (f: string) => {
	const b = montar(readFileSync(join(dir, f), 'utf8')).bytes;
	return [createHash('sha256').update(b).digest('hex').slice(0, 16), b.length];
};
const temLLVM = !!acharFerramenta('llvm-mc', 'LLVM_MC') && !!acharFerramenta('ld.lld', 'LD_LLD');

describe('exemplos', () => {
	test('glTF: idêntico ao gerado pela versão JavaScript', () => expect(sha('gltf-face.ttb')).toEqual(['a5c442280cb27216', 820]));
	test('MIDI (big-endian)', () => expect(sha('midi.ttb')).toEqual(['820a65af1a5e8b45', 62]));
	test('PDF mínimo', () => expect(sha('pdf-minimo.ttb')).toEqual(['22908cbedc7ad792', 594]));
	test('PDF: a xref aponta para cada objeto, mesmo com a frase trocada', () => {
		const fonte = readFileSync(join(dir, 'pdf-minimo.ttb'), 'utf8');
		for (const frase of ['Feito com txt2bin!', 'Uma frase bem mais longa, e a xref se ajusta sozinha.']) {
			const pdf = Buffer.from(montar(fonte.replace('Feito com txt2bin!', frase)).bytes).toString('latin1');
			const inicioXref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(pdf)![1]);
			expect(pdf.startsWith('xref\n0 6\n', inicioXref)).toBe(true);
			const entradas = pdf.slice(inicioXref + 'xref\n0 6\n'.length);
			for (let i = 1; i <= 5; i++) expect(pdf.startsWith(`${i} 0 obj`, Number(entradas.slice(i * 20, i * 20 + 10)))).toBe(true);
			const m = /\/Length (\d+) >> stream\n/.exec(pdf)!;
			expect(pdf.startsWith('endstream', m.index + m[0].length + Number(m[1]))).toBe(true);
		}
	});
	test('expressões', () => expect(sha('expressoes.ttb')).toEqual(['5ed5d118de5c4965', 124]));
	test.skipIf(!temLLVM)('setor de boot x86', () => expect(sha('boot-x86.ttb')).toEqual(['841e257a5f224427', 512]));
	test.skipIf(!temLLVM)('Arduino blink (AVR)', () => expect(sha('arduino-blink.ttb')).toEqual(['7ab2a14e96aa95fd', 20]));
});

describe('CLI', () => {
	const cli = (...args: string[]) => spawnSync('bun', [join(import.meta.dir, '..', 'src', 'cli.ts'), ...args], { encoding: 'utf8' });
	test('hex na saída padrão e erro com arquivo:linha', () => {
		expect(cli(join(dir, 'midi.ttb'), '-f', 'hex').stdout.slice(0, 8)).toBe('4d546864');
		const r = cli('/dev/stdin');
		expect(r.status).toBe(1);
	});
});
