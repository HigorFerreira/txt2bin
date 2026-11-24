import { ErroFonte } from './erros.ts';

/** Uma seção bruta: a linha "<<..." e o texto até a próxima diretiva. */
export interface SecaoBruta {
	cabecalho: string;		 // texto depois de "<<", sem a quebra de linha
	linha: number;				 // linha do cabeçalho (1-based)
	corpo: string;				 // conteúdo cru, escapes preservados
	linhaCorpo: number;		// linha onde o corpo começa
}

/**
 * Quebra a fonte em seções. Uma diretiva é "<<" na COLUNA 0 de uma linha.
 * "<<" no meio da linha é texto comum (por isso os operadores << e >>
 * funcionam nas expressões). Para começar uma linha de texto com "<<",
 * escape o primeiro "<":	\<<
 */
export function separarSecoes(fonte: string): SecaoBruta[] {
	const linhas = fonte.replace(/\r\n?/g, '\n').split('\n');
	const secoes: SecaoBruta[] = [];
	let atual: SecaoBruta | null = null;
	let corpo: string[] = [];

	const fechar = () => {
		if (atual) {
			atual.corpo = corpo.join('\n');
			secoes.push(atual);
		} else {
			const k = corpo.findIndex(l => l.trim() !== '');
			if (k >= 0) throw new ErroFonte(k + 1, 'conteúdo antes da primeira diretiva "<<"');
		}
	};

	linhas.forEach((texto, i) => {
		if (texto.startsWith('<<')) {
			fechar();
			atual = { cabecalho: texto.slice(2).trim(), linha: i + 1, corpo: '', linhaCorpo: i + 2 };
			corpo = [];
		} else {
			corpo.push(texto);
		}
	});
	fechar();
	return secoes;
}

/** Cabeçalho interpretado: nome, parâmetro entre parênteses, "+", argumentos. */
export interface Cabecalho {
	nome: string;
	param?: string;
	bigEndian: boolean;
	args: string;					// resto da linha (argumentos/opções)
}

export function lerCabecalho(s: SecaoBruta): Cabecalho {
	const c = s.cabecalho;
	if (c === '') throw new ErroFonte(s.linha, 'diretiva vazia');
	if (c.startsWith('#')) return { nome: '#', bigEndian: false, args: c.slice(1) };
	if (c.startsWith('@')) return { nome: '@', param: c.slice(1).trim(), bigEndian: false, args: '' };
	const m = /^([A-Za-z_][A-Za-z0-9_]*)(?:\(([^)]*)\))?(\+)?(?:\s+(.*))?$/.exec(c);
	if (!m) throw new ErroFonte(s.linha, `cabeçalho inválido "<<${c}"`);
	return { nome: m[1]!.toLowerCase(), param: m[2]?.trim(), bigEndian: m[3] === '+', args: (m[4] ?? '').trim() };
}
