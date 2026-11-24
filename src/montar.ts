import { montar as montarAsm, ErroAsm, type Config } from './asm/montador.ts';
import { base64, decodificarTexto, hex, TIPOS, utf16, type TipoNum } from './codificar.ts';
import { ehErroFonte, ErroFonte } from './erros.ts';
import { avaliar, ErroExpr, rotulosCitados, separarTermos, type Contexto, type Termo, type Valor } from './expr.ts';
import { msg } from './mensagens.ts';
import { lerCabecalho, separarSecoes, type Cabecalho, type SecaoBruta } from './secoes.ts';

export interface Opcoes {
	config?: Config;
	/** máximo de passadas do layout (padrão 32) */
	maxPassadas?: number;
}

/** Uma seção já interpretada, com posição e tamanho no arquivo final. */
export interface Item {
	secao: SecaoBruta;
	cab: Cabecalho;
	tipo: 'comentario' | 'rotulo' | 'bytes' | 'numeros' | 'texto' | 'fill' | 'align' | 'asm';
	offset: number;
	tamanho: number;
	bytes?: Uint8Array;
	num?: { tipo: TipoNum; termos: Termo[] };
	/** <<decimal / <<octal: números escritos como texto ASCII */
	texto?: { base: 8 | 10; largura?: number; termos: Termo[] };
	rotulo?: string;
	preenchimento?: number;
	expr?: Termo;					// fill: quantidade; align: múltiplo
	asm?: { arquitetura: string; opcoes: Record<string, string>; org?: Termo };
}

export interface Resultado {
	bytes: Uint8Array;
	itens: Item[];
	rotulos: Map<string, bigint>;
	passadas: number;
}

const NUMERICOS = new Set(Object.keys(TIPOS));
const PODE_BIG_ENDIAN = new Set([...NUMERICOS, 'utf16']);
const BASES_TEXTO: Record<string, 8 | 10> = { decimal: 10, octal: 8 };

/** Envolve erros de expressão/codificação com a linha da seção. */
function naLinha<T>(linha: number, f: () => T): T {
	try { return f(); }
	catch (e) {
		if (ehErroFonte(e)) throw e;
		if (e instanceof ErroExpr || e instanceof Error) throw new ErroFonte(linha, e.message);
		throw e;
	}
}

function argsOpcoes(args: string, linha: number): { posicionais: Termo[]; opcoes: Record<string, string> } {
	const posicionais: Termo[] = [];
	const opcoes: Record<string, string> = {};
	for (const t of naLinha(linha, () => separarTermos(args, linha))) {
		const m = /^([A-Za-z_]\w*)=(.*)$/.exec(t.src);
		if (m) opcoes[m[1]!.toLowerCase()] = m[2]!;
		else posicionais.push(t);
	}
	return { posicionais, opcoes };
}

function lerByte(s: string | undefined, linha: number): number {
	if (s === undefined) return 0;
	const v = parseInt(s, 16);
	if (!/^[0-9a-fA-F]{1,2}$/.test(s)) throw new ErroFonte(linha, msg().bytePreenchimento(s));
	return v;
}

// ---------------------------------------------------------------------------
// 1. Interpretação das seções
// ---------------------------------------------------------------------------
function interpretar(secoes: SecaoBruta[]): Item[] {
	return secoes.map(s => {
		const cab = lerCabecalho(s);
		const base = { secao: s, cab, offset: 0, tamanho: 0 };
		const L = s.linha;
		if (cab.bigEndian && !PODE_BIG_ENDIAN.has(cab.nome)) {
			throw new ErroFonte(L, msg().bigEndianNaoSeAplica(cab.nome));
		}
		const semArgs = () => { if (cab.args) throw new ErroFonte(L, msg().semArgumentos(cab.nome, cab.args)); };
		const semCorpo = () => { if (s.corpo.trim()) throw new ErroFonte(s.linhaCorpo, msg().semConteudo(cab.nome)); };

		switch (cab.nome) {
			case '#': return { ...base, tipo: 'comentario' } as Item;
			case '@': {
				if (!cab.param || !/^[A-Za-z_][\w.]*$/.test(cab.param)) throw new ErroFonte(L, msg().nomeRotuloInvalido(String(cab.param)));
				semCorpo();
				return { ...base, tipo: 'rotulo', rotulo: cab.param } as Item;
			}
			case 'utf8': semArgs(); return { ...base, tipo: 'bytes', bytes: naLinha(L, () => new TextEncoder().encode(decodificarTexto(s.corpo))) } as Item;
			case 'utf16': semArgs(); return { ...base, tipo: 'bytes', bytes: naLinha(L, () => utf16(decodificarTexto(s.corpo), cab.bigEndian)) } as Item;
			case 'hex': semArgs(); return { ...base, tipo: 'bytes', bytes: naLinha(L, () => hex(s.corpo)) } as Item;
			case 'base64': semArgs(); return { ...base, tipo: 'bytes', bytes: naLinha(L, () => base64(s.corpo, false)) } as Item;
			case 'base64url': semArgs(); return { ...base, tipo: 'bytes', bytes: naLinha(L, () => base64(s.corpo, true)) } as Item;
			case 'align':
			case 'fill': {
				semCorpo();
				const { posicionais, opcoes } = argsOpcoes(cab.args, L);
				if (Object.keys(opcoes).length || posicionais.length < 1 || posicionais.length > 2)
					throw new ErroFonte(L, msg().usoAlignFill(cab.nome));
				return { ...base, tipo: cab.nome, expr: posicionais[0], preenchimento: lerByte(posicionais[1]?.src, L) } as Item;
			}
			case 'decimal':
			case 'octal': {
				const { posicionais, opcoes } = argsOpcoes(cab.args, L);
				if (Object.keys(opcoes).length || posicionais.length > 1 || (posicionais[0] && !/^\d+$/.test(posicionais[0].src)))
					throw new ErroFonte(L, msg().usoTextoNumerico(cab.nome));
				const largura = posicionais[0] ? Number(posicionais[0].src) : undefined;
				if (largura === 0) throw new ErroFonte(L, msg().usoTextoNumerico(cab.nome));
				const termos = naLinha(s.linhaCorpo, () => separarTermos(s.corpo, s.linhaCorpo));
				return { ...base, tipo: 'texto', texto: { base: BASES_TEXTO[cab.nome]!, largura, termos } } as Item;
			}
			case 'assembly': {
				if (!cab.param) throw new ErroFonte(L, msg().informeArquitetura());
				const { posicionais, opcoes } = argsOpcoes(cab.args, L);
				if (posicionais.length) throw new ErroFonte(L, msg().argumentoInesperado(posicionais[0]!.src));
				const org = opcoes.org !== undefined ? { src: opcoes.org, linha: L } : undefined;
				delete opcoes.org;
				return { ...base, tipo: 'asm', asm: { arquitetura: cab.param, opcoes, org } } as Item;
			}
		}
		if (NUMERICOS.has(cab.nome)) {
			semArgs();
			const termos = naLinha(s.linhaCorpo, () => separarTermos(s.corpo, s.linhaCorpo));
			const tipo = TIPOS[cab.nome]!;
			return { ...base, tipo: 'numeros', num: { tipo, termos }, tamanho: termos.length * tipo.bytes } as Item;
		}
		throw new ErroFonte(L, msg().diretivaDesconhecida(cab.nome));
	});
}

// ---------------------------------------------------------------------------
// 2. Layout em ponto fixo
// ---------------------------------------------------------------------------
// Os tamanhos de <<fill, <<align e <<assembly podem depender de rótulos, e os
// rótulos dependem dos tamanhos. Começamos com todos os rótulos em 0 e
// repetimos até nada mudar.

function inteiroDe(v: Valor, onde: string): bigint {
	if (typeof v === 'bigint') return v;
	if (Number.isInteger(v)) return BigInt(v);
	throw new ErroExpr(msg().precisaSerInteiro(onde, String(v)));
}

/** Um valor de <<decimal / <<octal como texto, com a largura e as regras do tipo. */
function textoNumerico(it: Item, t: Termo, aqui: bigint, rotulos: Map<string, bigint>): string {
	const { base, largura } = it.texto!;
	const v = inteiroDe(avaliar(t.src, { rotulos, aqui }), msg().valorEm(it.cab.nome));
	if (base === 8 && v < 0n) throw new ErroExpr(msg().octalNegativo(t.src, String(v)));
	const digitos = (v < 0n ? -v : v).toString(base);
	const sinal = v < 0n ? '-' : '';
	if (largura === undefined) return sinal + digitos;
	if (sinal.length + digitos.length > largura) throw new ErroExpr(msg().naoCabeNaLargura(t.src, sinal + digitos, largura));
	return sinal + digitos.padStart(largura - sinal.length, '0');
}

function substituirExpressoes(codigo: string, linhaCorpo: number, ctx: Contexto): string {
	return codigo.split('\n').map((l, k) =>
		l.replace(/\$\{([^}]*)\}/g, (_, e: string) => naLinha(linhaCorpo + k, () => {
			const v = avaliar(e, ctx);
			return typeof v === 'bigint' ? v.toString() : String(v);
		}))).join('\n');
}

function dimensionar(itens: Item[], rotulos: Map<string, bigint>, opcoes: Opcoes): Map<string, bigint> {
	const novos = new Map<string, bigint>();
	let off = 0;
	for (const it of itens) {
		it.offset = off;
		const ctx: Contexto = { rotulos, aqui: BigInt(off) };
		switch (it.tipo) {
			case 'rotulo': novos.set(it.rotulo!, BigInt(off)); it.tamanho = 0; break;
			case 'bytes': it.tamanho = it.bytes!.length; break;
			case 'align': {
				const n = naLinha(it.secao.linha, () => inteiroDe(avaliar(it.expr!.src, ctx), msg().oAlinhamento()));
				if (n < 1n) throw new ErroFonte(it.secao.linha, msg().alinhamentoMinimo());
				it.tamanho = Number((n - (BigInt(off) % n)) % n);
				break;
			}
			case 'texto': {
				// o tamanho depende dos valores; durante as passadas os rótulos são
				// provisórios, então um valor que ainda não é válido conta pela largura
				it.tamanho = it.texto!.termos.reduce((soma, t) => {
					try { return soma + textoNumerico(it, t, BigInt(off) + BigInt(soma), rotulos).length; }
					catch { return soma + (it.texto!.largura ?? 1); }
				}, 0);
				break;
			}
			case 'fill': {
				const n = naLinha(it.secao.linha, () => inteiroDe(avaliar(it.expr!.src, ctx), msg().aQuantidadeDoFill()));
				// durante as primeiras passadas os rótulos são provisórios e o valor pode ser negativo
				it.tamanho = Number(n < 0n ? 0n : n);
				break;
			}
			case 'asm': {
				const org = it.asm!.org ? naLinha(it.secao.linha, () => inteiroDe(avaliar(it.asm!.org!.src, ctx), 'org')) : BigInt(off);
				const codigo = substituirExpressoes(it.secao.corpo, it.secao.linhaCorpo, ctx);
				try {
					it.bytes = montarAsm({ arquitetura: it.asm!.arquitetura, codigo, org, opcoes: it.asm!.opcoes, config: opcoes.config });
				} catch (e) {
					if (e instanceof ErroAsm) {
						const linha = e.linhaRelativa !== undefined ? it.secao.linhaCorpo + e.linhaRelativa - 1 : it.secao.linha;
						throw new ErroFonte(linha, `assembly(${it.asm!.arquitetura}): ${e.message}`);
					}
					throw e;
				}
				it.tamanho = it.bytes.length;
				break;
			}
		}
		off += it.tamanho;
	}
	return novos;
}

function iguais(a: Map<string, bigint>, b: Map<string, bigint>) {
	if (a.size !== b.size) return false;
	for (const [k, v] of a) if (b.get(k) !== v) return false;
	return true;
}

// ---------------------------------------------------------------------------
// 3. Montagem
// ---------------------------------------------------------------------------
export function montar(fonte: string, opcoes: Opcoes = {}): Resultado {
	const itens = interpretar(separarSecoes(fonte));

	// Rótulos: nomes únicos e todas as referências conhecidas
	const definidos = new Map<string, number>();
	for (const it of itens) if (it.tipo === 'rotulo') {
		if (definidos.has(it.rotulo!)) throw new ErroFonte(it.secao.linha, msg().rotuloDuplicado(it.rotulo!, definidos.get(it.rotulo!)!));
		definidos.set(it.rotulo!, it.secao.linha);
	}
	const checar = (src: string, linha: number) => {
		for (const r of rotulosCitados(src)) if (!definidos.has(r)) throw new ErroFonte(linha, msg().rotuloIndefinido(r));
	};
	for (const it of itens) {
		it.num?.termos.forEach(t => checar(t.src, t.linha));
		it.texto?.termos.forEach(t => checar(t.src, t.linha));
		if (it.expr) checar(it.expr.src, it.secao.linha);
		if (it.asm?.org) checar(it.asm.org.src, it.secao.linha);
		if (it.tipo === 'asm') it.secao.corpo.split('\n').forEach((l, k) => {
			for (const m of l.matchAll(/\$\{([^}]*)\}/g)) checar(m[1]!, it.secao.linhaCorpo + k);
		});
	}

	let rotulos = new Map([...definidos.keys()].map(k => [k, 0n]));
	const max = opcoes.maxPassadas ?? 32;
	let passadas = 0;
	for (;;) {
		passadas++;
		const novos = dimensionar(itens, rotulos, opcoes);
		if (iguais(novos, rotulos)) break;
		if (passadas >= max) throw new ErroFonte(1, msg().naoEstabilizou(max));
		rotulos = novos;
	}

	// Valores finais de fill (agora não podem ser negativos)
	for (const it of itens) if (it.tipo === 'fill') {
		const n = naLinha(it.secao.linha, () => inteiroDe(avaliar(it.expr!.src, { rotulos, aqui: BigInt(it.offset) }), msg().aQuantidadeDoFill()));
		if (n < 0n) throw new ErroFonte(it.secao.linha, msg().fillNegativo(String(n)));
	}

	// Valores finais dos números em texto (agora com as regras completas)
	for (const it of itens) if (it.tipo === 'texto') {
		let s = '';
		for (const t of it.texto!.termos) s += naLinha(t.linha, () => textoNumerico(it, t, BigInt(it.offset + s.length), rotulos));
		it.bytes = new TextEncoder().encode(s);
	}

	// Emissão
	const total = itens.reduce((s, it) => Math.max(s, it.offset + it.tamanho), 0);
	const out = new Uint8Array(total);
	const dv = new DataView(out.buffer);
	for (const it of itens) {
		if (it.bytes) out.set(it.bytes, it.offset);
		if (it.tipo === 'fill' || it.tipo === 'align') out.fill(it.preenchimento!, it.offset, it.offset + it.tamanho);
		if (it.tipo !== 'numeros') continue;
		const { tipo, termos } = it.num!;
		termos.forEach((t, k) => {
			const off = it.offset + k * tipo.bytes;
			naLinha(t.linha, () => {
				let v = avaliar(t.src, { rotulos, aqui: BigInt(off) });
				if (tipo.inteiro) {
					v = inteiroDe(v, msg().valorEm(it.cab.nome));
					if (v < tipo.min! || v > tipo.max!) throw new ErroExpr(msg().foraDoIntervalo(t.src, String(v), it.cab.nome, String(tipo.min), String(tipo.max)));
				}
				tipo.escrever(dv, off, v, !it.cab.bigEndian);
			});
		});
	}
	return { bytes: out, itens, rotulos, passadas };
}
