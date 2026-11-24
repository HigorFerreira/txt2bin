import { afterEach, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { assemble, ErroFonte, format, map, setLanguage } from '../src/index.ts';
import { definirIdioma, detectarIdioma, idiomaDe } from '../src/mensagens.ts';

const erro = (fonte: string) => {
	try { assemble(fonte); } catch (e) { if (e instanceof ErroFonte) return e.message; throw e; }
	throw new Error('esperava um erro');
};

afterEach(() => definirIdioma('pt'));

describe('detecção do idioma', () => {
	test('localidades', () => {
		expect(idiomaDe('pt_BR.UTF-8')).toBe('pt');
		expect(idiomaDe('pt-PT')).toBe('pt');
		expect(idiomaDe('pt')).toBe('pt');
		expect(idiomaDe('en_US.UTF-8')).toBe('en');
		expect(idiomaDe('de_DE')).toBe('en');
		expect(idiomaDe('C')).toBeUndefined();
		expect(idiomaDe(undefined)).toBeUndefined();
	});
	test('ordem das variáveis', () => {
		expect(detectarIdioma({ TXT2BIN_LANG: 'en', LANG: 'pt_BR.UTF-8' })).toBe('en');
		expect(detectarIdioma({ LC_ALL: 'pt_BR.UTF-8', LANG: 'en_US.UTF-8' })).toBe('pt');
		expect(detectarIdioma({ LANG: 'C', LANGUAGE: 'pt_BR:en' })).toBe('pt');
	});
	test('idioma inválido é recusado', () => {
		expect(() => definirIdioma('xx' as 'pt')).toThrow();
	});
});

describe('mensagens em inglês', () => {
	test('erros do conversor', () => {
		setLanguage('en');
		expect(erro('<<uint8\n$nope\n')).toBe('undefined label "$nope"');
		expect(erro('<<uint8\n300\n')).toBe('300 = 300 is out of range for uint8 (0…255)');
		expect(erro('<<uint8\n1 + 2\n')).toContain('wrap it in parentheses');
		expect(erro('<<base64\nSGk-\n')).toContain('is this base64url?');
		expect(erro('<<uint8\n(2 +\n')).toBe('"(" without a matching ")"');
	});
	test('mapa', () => {
		setLanguage('en');
		const m = map(assemble('<<@a\n<<uint16\n1 2\n'));
		expect(m).toContain('section');
		expect(m).toContain('(line 2)');
		expect(m).toContain('total: 4 bytes · 1 label(s) · 1 layout pass(es)');
	});
	test('as mesmas mensagens em português', () => {
		setLanguage('pt');
		expect(erro('<<uint8\n$nope\n')).toBe('rótulo indefinido "$nope"');
		expect(map(assemble('<<uint8\n1\n'))).toContain('passada(s) de layout');
	});
	test('nomes em inglês da API', () => {
		expect(format(assemble('<<hex\nCAFE\n').bytes, 'hex')).toBe('cafe\n');
	});
});

describe('linha de comando', () => {
	const cli = (args: string[], env: Record<string, string> = {}) =>
		spawnSync(process.execPath, [join(import.meta.dir, '../src/cli.ts'), ...args], {
			encoding: 'utf8', env: { ...process.env, LC_ALL: '', LC_MESSAGES: '', LANGUAGE: '', TXT2BIN_LANG: '', ...env },
		});
	test('--lang en', () => {
		const r = cli(['--lang', 'en', '--nope']);
		expect(r.stderr).toBe('error: unknown option --nope\n');
	});
	test('idioma do sistema', () => {
		expect(cli(['--nope'], { LANG: 'pt_BR.UTF-8' }).stderr).toBe('erro: opção desconhecida --nope\n');
		expect(cli(['--nope'], { LANG: 'en_US.UTF-8' }).stderr).toBe('error: unknown option --nope\n');
	});
	test('ajuda e --architectures em inglês', () => {
		expect(cli(['--help'], { TXT2BIN_LANG: 'en' }).stdout).toContain('write binary files as plain text');
		expect(cli(['--architectures'], { TXT2BIN_LANG: 'en' }).stdout).toContain('x86 16-bit (real mode, 8086, boot sectors)');
	});
});
