/**
 * Expressões aritméticas.
 *
 * Valores são bigint (inteiros exatos, até 64 bits ou mais) ou number
 * (ponto flutuante). Literais inteiros viram bigint; literais com ponto ou
 * expoente viram number. A aritmética mantém bigint enquanto puder.
 *
 * Precedência (da menor para a maior), como em Python:
 *	 |	 ^	 &	 << >>	 + -	 * / // %	 unários - + ~	 **	 ( )
 */

export type Valor = bigint | number;

export interface Contexto {
	rotulos: Map<string, bigint>;
	aqui: bigint;							// $.	= offset do valor sendo escrito
}

export class ErroExpr extends Error {}

import { ErroFonte } from './erros.ts';
import { msg } from './mensagens.ts';

// ---------------------------------------------------------------------------
// Léxico
// ---------------------------------------------------------------------------
type Tok =
	| { t: 'num'; v: Valor }
	| { t: 'rot'; v: string }
	| { t: 'id'; v: string }
	| { t: 'op'; v: string }
	| { t: 'fim' };

const OPS = ['**', '//', '<<', '>>', '+', '-', '*', '/', '%', '&', '|', '^', '~', '(', ')', ','];

function lexico(src: string): Tok[] {
	const out: Tok[] = [];
	let i = 0;
	while (i < src.length) {
		const c = src[i]!;
		if (/\s/.test(c)) { i++; continue; }

		// números: 0x 0b 0o, decimais, reais, com separador _
		const num = /^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*)?\.?\d[\d_]*(?:[eE][+-]?\d+)?)/.exec(src.slice(i));
		if (num && /[\d.]/.test(c)) {
			const s = num[1]!.replace(/_/g, '');
			if (/^0[xXbBoO]/.test(s)) out.push({ t: 'num', v: BigInt(s) });
			else if (/[.eE]/.test(s)) out.push({ t: 'num', v: Number(s) });
			else out.push({ t: 'num', v: BigInt(s) });
			i += num[1]!.length;
			continue;
		}
		// caractere: 'A'	'\n'	'\''
		if (c === "'") {
			const m = /^'(\\.|[^'\\])'/u.exec(src.slice(i));
			if (!m) throw new ErroExpr(msg().caractereInvalido(src.slice(i)));
			const ch = m[1]!.startsWith('\\')
				? ({ n: '\n', r: '\r', t: '\t', '0': '\0', '\\': '\\', "'": "'" } as Record<string, string>)[m[1]![1]!]
				: m[1]!;
			if (ch === undefined) throw new ErroExpr(msg().escapeCaractere(m[0]));
			out.push({ t: 'num', v: BigInt(ch.codePointAt(0)!) });
			i += m[0].length;
			continue;
		}
		// rótulos: $nome	e	$.
		if (c === '$') {
			if (src[i + 1] === '.') { out.push({ t: 'rot', v: '.' }); i += 2; continue; }
			const m = /^\$([A-Za-z_][\w.]*)/.exec(src.slice(i));
			if (!m) throw new ErroExpr(msg().cifraoSemNome());
			out.push({ t: 'rot', v: m[1]! });
			i += m[0].length;
			continue;
		}
		const id = /^[A-Za-z_]\w*/.exec(src.slice(i));
		if (id) { out.push({ t: 'id', v: id[0] }); i += id[0].length; continue; }
		const op = OPS.find(o => src.startsWith(o, i));
		if (op) { out.push({ t: 'op', v: op }); i += op.length; continue; }
		throw new ErroExpr(msg().caractereInesperado(c));
	}
	out.push({ t: 'fim' });
	return out;
}

// ---------------------------------------------------------------------------
// Aritmética
// ---------------------------------------------------------------------------
const ehInt = (v: Valor): v is bigint => typeof v === 'bigint';
const num = (v: Valor) => Number(v);

function inteiro(v: Valor, op: string): bigint {
	if (ehInt(v)) return v;
	if (Number.isInteger(v)) return BigInt(v);
	throw new ErroExpr(msg().exigeInteiros(op, String(v)));
}

function binario(op: string, a: Valor, b: Valor): Valor {
	switch (op) {
		case '+': return ehInt(a) && ehInt(b) ? a + b : num(a) + num(b);
		case '-': return ehInt(a) && ehInt(b) ? a - b : num(a) - num(b);
		case '*': return ehInt(a) && ehInt(b) ? a * b : num(a) * num(b);
		case '/': {
			if (num(b) === 0) throw new ErroExpr(msg().divisaoPorZero());
			if (ehInt(a) && ehInt(b) && a % b === 0n) return a / b;	 // exata: continua inteira
			return num(a) / num(b);
		}
		case '//': {
			if (num(b) === 0) throw new ErroExpr(msg().divisaoPorZero());
			if (ehInt(a) && ehInt(b)) { const q = a / b; return (a % b !== 0n && (a < 0n) !== (b < 0n)) ? q - 1n : q; }
			return Math.floor(num(a) / num(b));
		}
		case '%': {
			if (num(b) === 0) throw new ErroExpr(msg().moduloPorZero());
			if (ehInt(a) && ehInt(b)) return ((a % b) + b) % b;
			return num(a) - num(b) * Math.floor(num(a) / num(b));
		}
		case '**':
			if (ehInt(a) && ehInt(b) && b >= 0n) return a ** b;
			return num(a) ** num(b);
		case '&': return inteiro(a, op) & inteiro(b, op);
		case '|': return inteiro(a, op) | inteiro(b, op);
		case '^': return inteiro(a, op) ^ inteiro(b, op);
		case '<<': return inteiro(a, op) << inteiro(b, op);
		case '>>': return inteiro(a, op) >> inteiro(b, op);
	}
	throw new ErroExpr(msg().operadorDesconhecido(op));
}

const f1 = (f: (x: number) => number) => (a: Valor[]) => f(num(a[0]!));
const paraInt = (f: (x: number) => number) => (a: Valor[]) => ehInt(a[0]!) ? a[0]! : BigInt(f(num(a[0]!)));

const FUNCOES: Record<string, { n: number | [number, number]; f: (a: Valor[]) => Valor }> = {
	sin: { n: 1, f: f1(Math.sin) }, cos: { n: 1, f: f1(Math.cos) }, tan: { n: 1, f: f1(Math.tan) },
	asin: { n: 1, f: f1(Math.asin) }, acos: { n: 1, f: f1(Math.acos) }, atan: { n: 1, f: f1(Math.atan) },
	atan2: { n: 2, f: a => Math.atan2(num(a[0]!), num(a[1]!)) },
	sqrt: { n: 1, f: f1(Math.sqrt) }, cbrt: { n: 1, f: f1(Math.cbrt) },
	exp: { n: 1, f: f1(Math.exp) }, log: { n: 1, f: f1(Math.log) },
	log2: { n: 1, f: f1(Math.log2) }, log10: { n: 1, f: f1(Math.log10) },
	hypot: { n: [1, 16], f: a => Math.hypot(...a.map(num)) },
	rad: { n: 1, f: a => num(a[0]!) * Math.PI / 180 },
	deg: { n: 1, f: a => num(a[0]!) * 180 / Math.PI },
	abs: { n: 1, f: a => ehInt(a[0]!) ? (a[0]! < 0n ? -a[0]! : a[0]!) : Math.abs(a[0]!) },
	min: { n: [1, 64], f: a => a.reduce((x, y) => (num(y) < num(x) ? y : x)) },
	max: { n: [1, 64], f: a => a.reduce((x, y) => (num(y) > num(x) ? y : x)) },
	floor: { n: 1, f: paraInt(Math.floor) }, ceil: { n: 1, f: paraInt(Math.ceil) },
	round: { n: 1, f: paraInt(Math.round) }, trunc: { n: 1, f: paraInt(Math.trunc) },
	int: { n: 1, f: paraInt(Math.trunc) },
	float: { n: 1, f: a => num(a[0]!) },
};
const CONSTANTES: Record<string, Valor> = { pi: Math.PI, tau: 2 * Math.PI, e: Math.E, inf: Infinity, nan: NaN };

// ---------------------------------------------------------------------------
// Sintaxe (descida recursiva)
// ---------------------------------------------------------------------------
const NIVEIS = [['|'], ['^'], ['&'], ['<<', '>>'], ['+', '-'], ['*', '/', '//', '%']];

export function avaliar(src: string, ctx: Contexto): Valor {
	if (/^\s*(\*\*|\/\/|<<|>>|[-+*/%&|^~])\s*$/.test(src))
		throw new ErroExpr(msg().operadorSozinho(src.trim()));
	const toks = lexico(src);
	let p = 0;
	const olha = () => toks[p]!;
	const ehOp = (v: string) => { const t = olha(); return t.t === 'op' && t.v === v; };
	const espera = (v: string) => { if (!ehOp(v)) throw new ErroExpr(msg().esperava(v, src)); p++; };

	const nivel = (k: number): Valor => {
		if (k === NIVEIS.length) return unario();
		let v = nivel(k + 1);
		for (;;) {
			const t = olha();
			if (t.t !== 'op' || !NIVEIS[k]!.includes(t.v)) return v;
			p++;
			v = binario(t.v, v, nivel(k + 1));
		}
	};
	const unario = (): Valor => {
		if (ehOp('-')) { p++; const v = unario(); return ehInt(v) ? -v : -v; }
		if (ehOp('+')) { p++; return unario(); }
		if (ehOp('~')) { p++; return ~inteiro(unario(), '~'); }
		return potencia();
	};
	const potencia = (): Valor => {
		const base = primario();
		if (ehOp('**')) { p++; return binario('**', base, unario()); }	 // associa à direita
		return base;
	};
	const primario = (): Valor => {
		const t = olha();
		if (t.t === 'num') { p++; return t.v; }
		if (t.t === 'rot') {
			p++;
			if (t.v === '.') return ctx.aqui;
			const v = ctx.rotulos.get(t.v);
			if (v === undefined) throw new ErroExpr(msg().rotuloIndefinido(t.v));
			return v;
		}
		if (t.t === 'id') {
			p++;
			if (ehOp('(')) {
				const fn = FUNCOES[t.v];
				if (!fn) throw new ErroExpr(msg().funcaoDesconhecida(t.v));
				p++;
				const args: Valor[] = [];
				if (!ehOp(')')) { args.push(nivel(0)); while (ehOp(',')) { p++; args.push(nivel(0)); } }
				espera(')');
				const [lo, hi] = typeof fn.n === 'number' ? [fn.n, fn.n] : fn.n;
				if (args.length < lo || args.length > hi) throw new ErroExpr(msg().argumentos(t.v, args.length));
				return fn.f(args);
			}
			if (t.v in CONSTANTES) return CONSTANTES[t.v]!;
			throw new ErroExpr(msg().nomeDesconhecido(t.v));
		}
		if (ehOp('(')) { p++; const v = nivel(0); espera(')'); return v; }
		if (t.t === 'fim') throw new ErroExpr(msg().expressaoIncompleta(src));
		throw new ErroExpr(msg().inesperado((t as { v: string }).v, src));
	};

	const v = nivel(0);
	if (olha().t !== 'fim') {
		const t = olha() as { v: unknown };
		throw new ErroExpr(msg().sobrou(String(t.v), src));
	}
	return v;
}

/** Rótulos citados numa expressão (para checar existência sem avaliar). */
export function rotulosCitados(src: string): string[] {
	try { return lexico(src).filter(t => t.t === 'rot' && t.v !== '.').map(t => (t as { v: string }).v); }
	catch { return []; }
}

// ---------------------------------------------------------------------------
// Separação de valores no corpo de uma seção numérica
// ---------------------------------------------------------------------------
export interface Termo { src: string; linha: number; }

/**
 * Separa um corpo em termos. Espaços separam valores, exceto dentro de
 * parênteses. "#" começa um comentário até o fim da linha.
 */
export function separarTermos(corpo: string, linhaInicial: number): Termo[] {
	const out: Termo[] = [];
	let atual = '', prof = 0, linha = linhaInicial, linhaTermo = linhaInicial, linhaAbre = linhaInicial;
	const fechar = () => { if (atual) out.push({ src: atual, linha: linhaTermo }); atual = ''; };
	for (let i = 0; i < corpo.length; i++) {
		const c = corpo[i]!;
		if (c === "'") {																	 // literal de caractere
			const m = /^'(\\.|[^'\\])'/u.exec(corpo.slice(i));
			if (m) { if (!atual) linhaTermo = linha; atual += m[0]; i += m[0].length - 1; continue; }
		}
		if (c === '#') {																	 // comentário
			while (i < corpo.length && corpo[i] !== '\n') i++;
			i--;
			continue;
		}
		if (c === '\n') linha++;
		if (/\s/.test(c) && prof === 0) { fechar(); continue; }
		if (c === '(' && prof++ === 0) linhaAbre = linha;
		if (c === ')' && --prof < 0) throw new ErroFonte(linha, msg().fechaSemAbre());
		if (!atual) linhaTermo = linha;
		atual += c === '\n' ? ' ' : c;
	}
	if (prof !== 0) throw new ErroFonte(linhaAbre, msg().abreSemFecha());
	fechar();
	return out;
}
