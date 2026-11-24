/**
 * Mensagens em português e inglês.
 *
 * O idioma vem de TXT2BIN_LANG ou do idioma do sistema (LC_ALL, LC_MESSAGES,
 * LANG, LANGUAGE e, por fim, Intl). Português se começar com "pt"; inglês nos
 * demais casos. definirIdioma() troca em tempo de execução (CLI --lang, VS Code).
 */

export type Idioma = 'pt' | 'en';

const pt = {
	// seções
	conteudoAntes: () => 'conteúdo antes da primeira diretiva "<<"',
	diretivaVazia: () => 'diretiva vazia',
	cabecalhoInvalido: (c: string) => `cabeçalho inválido "<<${c}"`,

	// texto, hex, base64
	escapeU: () => 'escape \\u inválido, use \\u{HHHH}',
	barraNoFim: () => '"\\" no fim do texto',
	escapeDesconhecido: (e: string) => `escape desconhecido "\\${e}"`,
	naoHex: () => 'caractere não hexadecimal',
	hexImpar: (n: number) => `número ímpar de dígitos hex (${n})`,
	foraDoAlfabeto: (c: string, alfabeto: string) => `caractere "${c}" não pertence ao alfabeto ${alfabeto}`,
	dicaBase64url: () => ' (isso é base64url? use <<base64url)',
	base64Comprimento: () => 'comprimento base64 inválido',
	base64Preenchimento: () => 'preenchimento "=" incorreto',

	// expressões
	caractereInvalido: (s: string) => `literal de caractere inválido em "${s}"`,
	escapeCaractere: (s: string) => `escape desconhecido em ${s}`,
	cifraoSemNome: () => '"$" precisa ser seguido de um nome de rótulo ou "."',
	caractereInesperado: (c: string) => `caractere inesperado "${c}"`,
	exigeInteiros: (op: string, v: string) => `o operador ${op} exige inteiros (recebeu ${v})`,
	divisaoPorZero: () => 'divisão por zero',
	moduloPorZero: () => 'módulo por zero',
	operadorDesconhecido: (op: string) => `operador desconhecido ${op}`,
	operadorSozinho: (op: string) => `"${op}" sozinho — para usar espaços numa expressão, coloque-a entre parênteses: (1 + 2)`,
	esperava: (v: string, src: string) => `esperava "${v}" em "${src}"`,
	rotuloIndefinido: (n: string) => `rótulo indefinido "$${n}"`,
	funcaoDesconhecida: (n: string) => `função desconhecida "${n}"`,
	argumentos: (f: string, n: number) => `${f}() recebeu ${n} argumento(s)`,
	nomeDesconhecido: (n: string) => `nome desconhecido "${n}" (rótulos começam com $)`,
	expressaoIncompleta: (src: string) => `expressão incompleta "${src}"`,
	inesperado: (v: string, src: string) => `"${v}" inesperado em "${src}"`,
	sobrou: (v: string, src: string) => `sobrou "${v}" em "${src}" — para usar espaços numa expressão, coloque-a entre parênteses`,
	fechaSemAbre: () => '")" sem "(" correspondente',
	abreSemFecha: () => '"(" sem ")" correspondente',

	// seções e layout
	bytePreenchimento: (s: string) => `byte de preenchimento deve ser hex (00–FF), recebeu "${s}"`,
	bigEndianNaoSeAplica: (nome: string) => `"+" (big-endian) não se aplica a <<${nome}: só números de mais de um byte e utf16 têm ordem de bytes`,
	semArgumentos: (nome: string, args: string) => `<<${nome} não aceita argumentos ("${args}")`,
	semConteudo: (nome: string) => `<<${nome} não tem conteúdo`,
	nomeRotuloInvalido: (n: string) => `nome de rótulo inválido "${n}"`,
	usoAlignFill: (nome: string) => `uso: <<${nome} N [HH]`,
	informeArquitetura: () => 'informe a arquitetura: <<assembly(x86_64), <<assembly(avr)…',
	argumentoInesperado: (s: string) => `argumento inesperado "${s}" (use chave=valor)`,
	diretivaDesconhecida: (nome: string) => `diretiva desconhecida "<<${nome}"`,
	precisaSerInteiro: (onde: string, v: string) => `${onde} precisa ser inteiro (deu ${v})`,
	oAlinhamento: () => 'o alinhamento',
	aQuantidadeDoFill: () => 'a quantidade do fill',
	valorEm: (tipo: string) => `valor em <<${tipo}`,
	alinhamentoMinimo: () => 'o alinhamento deve ser ≥ 1',
	rotuloDuplicado: (n: string, linha: number) => `rótulo "${n}" já definido na linha ${linha}`,
	naoEstabilizou: (max: number) => `o layout não estabilizou em ${max} passadas (tamanhos que dependem uns dos outros em ciclo?)`,
	usoTextoNumerico: (nome: string) => `uso: <<${nome} [largura], com a largura em dígitos (ex.: <<${nome} 10)`,
	naoCabeNaLargura: (src: string, texto: string, largura: number) => `${src} = ${texto} não cabe em ${largura} dígito(s)`,
	octalNegativo: (src: string, v: string) => `${src} = ${v}: <<octal não aceita números negativos`,
	fillNegativo: (n: string) => `fill com quantidade negativa (${n}): o conteúdo anterior já passou do limite`,
	foraDoIntervalo: (src: string, v: string, tipo: string, min: string, max: string) => `${src} = ${v} está fora do intervalo de ${tipo} (${min}…${max})`,

	// assembly
	arquiteturaDesconhecida: (a: string, lista: string) =>
		`arquitetura desconhecida "${a}". Disponíveis: ${lista}. Também dá para passar triple=<llvm-triple> ou configurar um backend próprio.`,
	dicaInstalar: () =>
		'instale o LLVM: macOS "brew install llvm lld"; Debian/Ubuntu "apt install llvm lld"; ' +
		'Windows "winget install LLVM.LLVM". Ou aponte as variáveis LLVM_MC e LD_LLD para os executáveis.',
	llvmMcAusente: (dica: string) => `llvm-mc não encontrado; ${dica}`,
	sintaxeInvalida: (s: string) => `syntax deve ser intel ou att (recebeu "${s}")`,
	falhaAoExecutar: (exe: string, msg: string) => `falha ao executar ${exe}: ${msg}`,
	dadosForaDoText: (lista: string) => `o código gerou dados fora de .text (${lista}). Escreva tudo na seção padrão, sem .data/.bss/.section.`,
	precisaLld: (dica: string) => `o código tem relocações e precisa do ld.lld para resolvê-las; ${dica}`,
	lldFalhou: (msg: string) => `ld.lld falhou: ${msg}`,
	dicaSimboloIndefinido: () => ' (rótulo inexistente no código?)',
	ligadorEndereco: (a: string, b: string) => `o ligador pôs o código em ${a} em vez de ${b}`,
	erroDoMontador: () => 'erro do montador',
	terminouComCodigo: (exe: string, status: string, saida: string) => `"${exe}" terminou com código ${status}:\n${saida}`,
	naoGerouSaida: (exe: string) => `"${exe}" não gerou o arquivo de saída {out}`,

	// mapa
	mapaCabecalho: () => '	offset (hex)	 offset	 tamanho	relativo						seção',
	mapaLinha: (n: number) => `(linha ${n})`,
	mapaTotal: (bytes: number, rotulos: number, passadas: number) =>
		`total: ${bytes} bytes · ${rotulos} rótulo(s) · ${passadas} passada(s) de layout`,

	// linha de comando
	ajuda: (formatos: string) => `txt2bin — escreva arquivos binários em texto puro

uso:
	txt2bin entrada.ttb [saida] [opções]
	txt2bin entrada.ttb -o saida.bin --map

opções:
	-o, --out ARQ			arquivo de saída ("-" = saída padrão)
	-f, --format FMT		${formatos}	 (padrão: bin)
	--mime TIPO				tipo MIME do datauri (padrão application/octet-stream)
	--map					mostra o mapa de seções e rótulos
	--config ARQ			configuração de backends de assembly
							(padrão: txt2bin.config.json ao lado da entrada)
	--arquiteturas			lista as arquiteturas de <<assembly(...)
	--lang pt|en			idioma das mensagens (padrão: o do sistema)
	-h, --help				esta ajuda
`,
	precisaValor: (op: string) => `${op} precisa de um valor`,
	opcaoDesconhecida: (op: string) => `opção desconhecida ${op}`,
	idiomaDesconhecido: (i: string) => `idioma desconhecido "${i}" (use pt ou en)`,
	tambem: (lista: string) => `[também: ${lista}]`,
	naoEncontrado: () => 'NÃO ENCONTRADO',
	formatoDesconhecido: (f: string) => `formato desconhecido "${f}"`,
	configNaoEncontrada: (arq: string) => `configuração não encontrada: ${arq}`,
	informeSaida: () => 'informe a saída (arquivo ou "-") ou use --map / --format',
	erro: () => 'erro',
};

export type Mensagens = typeof pt;

const en: Mensagens = {
	conteudoAntes: () => 'content before the first "<<" directive',
	diretivaVazia: () => 'empty directive',
	cabecalhoInvalido: c => `invalid header "<<${c}"`,

	escapeU: () => 'invalid \\u escape, use \\u{HHHH}',
	barraNoFim: () => '"\\" at the end of the text',
	escapeDesconhecido: e => `unknown escape "\\${e}"`,
	naoHex: () => 'non-hexadecimal character',
	hexImpar: n => `odd number of hex digits (${n})`,
	foraDoAlfabeto: (c, alfabeto) => `character "${c}" is not in the ${alfabeto} alphabet`,
	dicaBase64url: () => ' (is this base64url? use <<base64url)',
	base64Comprimento: () => 'invalid base64 length',
	base64Preenchimento: () => 'incorrect "=" padding',

	caractereInvalido: s => `invalid character literal in "${s}"`,
	escapeCaractere: s => `unknown escape in ${s}`,
	cifraoSemNome: () => '"$" must be followed by a label name or "."',
	caractereInesperado: c => `unexpected character "${c}"`,
	exigeInteiros: (op, v) => `operator ${op} needs integers (got ${v})`,
	divisaoPorZero: () => 'division by zero',
	moduloPorZero: () => 'modulo by zero',
	operadorDesconhecido: op => `unknown operator ${op}`,
	operadorSozinho: op => `"${op}" on its own — to use spaces in an expression, wrap it in parentheses: (1 + 2)`,
	esperava: (v, src) => `expected "${v}" in "${src}"`,
	rotuloIndefinido: n => `undefined label "$${n}"`,
	funcaoDesconhecida: n => `unknown function "${n}"`,
	argumentos: (f, n) => `${f}() got ${n} argument(s)`,
	nomeDesconhecido: n => `unknown name "${n}" (labels start with $)`,
	expressaoIncompleta: src => `incomplete expression "${src}"`,
	inesperado: (v, src) => `unexpected "${v}" in "${src}"`,
	sobrou: (v, src) => `leftover "${v}" in "${src}" — to use spaces in an expression, wrap it in parentheses`,
	fechaSemAbre: () => '")" without a matching "("',
	abreSemFecha: () => '"(" without a matching ")"',

	bytePreenchimento: s => `padding byte must be hex (00–FF), got "${s}"`,
	bigEndianNaoSeAplica: nome => `"+" (big-endian) does not apply to <<${nome}: only numbers wider than one byte and utf16 have a byte order`,
	semArgumentos: (nome, args) => `<<${nome} takes no arguments ("${args}")`,
	semConteudo: nome => `<<${nome} takes no content`,
	nomeRotuloInvalido: n => `invalid label name "${n}"`,
	usoAlignFill: nome => `usage: <<${nome} N [HH]`,
	informeArquitetura: () => 'name the architecture: <<assembly(x86_64), <<assembly(avr)…',
	argumentoInesperado: s => `unexpected argument "${s}" (use key=value)`,
	diretivaDesconhecida: nome => `unknown directive "<<${nome}"`,
	precisaSerInteiro: (onde, v) => `${onde} must be an integer (got ${v})`,
	oAlinhamento: () => 'the alignment',
	aQuantidadeDoFill: () => 'the fill count',
	valorEm: tipo => `value in <<${tipo}`,
	alinhamentoMinimo: () => 'the alignment must be ≥ 1',
	rotuloDuplicado: (n, linha) => `label "${n}" already defined on line ${linha}`,
	naoEstabilizou: max => `the layout did not settle after ${max} passes (sizes that depend on each other in a cycle?)`,
	usoTextoNumerico: nome => `usage: <<${nome} [width], with the width in digits (e.g. <<${nome} 10)`,
	naoCabeNaLargura: (src, texto, largura) => `${src} = ${texto} does not fit in ${largura} digit(s)`,
	octalNegativo: (src, v) => `${src} = ${v}: <<octal does not accept negative numbers`,
	fillNegativo: n => `fill with a negative count (${n}): the content before it is already past the limit`,
	foraDoIntervalo: (src, v, tipo, min, max) => `${src} = ${v} is out of range for ${tipo} (${min}…${max})`,

	arquiteturaDesconhecida: (a, lista) =>
		`unknown architecture "${a}". Available: ${lista}. You can also pass triple=<llvm-triple> or configure a custom backend.`,
	dicaInstalar: () =>
		'install LLVM: macOS "brew install llvm lld"; Debian/Ubuntu "apt install llvm lld"; ' +
		'Windows "winget install LLVM.LLVM". Or point the LLVM_MC and LD_LLD variables at the executables.',
	llvmMcAusente: dica => `llvm-mc not found; ${dica}`,
	sintaxeInvalida: s => `syntax must be intel or att (got "${s}")`,
	falhaAoExecutar: (exe, msg) => `failed to run ${exe}: ${msg}`,
	dadosForaDoText: lista => `the code produced data outside .text (${lista}). Keep everything in the default section, without .data/.bss/.section.`,
	precisaLld: dica => `the code has relocations and needs ld.lld to resolve them; ${dica}`,
	lldFalhou: msg => `ld.lld failed: ${msg}`,
	dicaSimboloIndefinido: () => ' (a label missing from the code?)',
	ligadorEndereco: (a, b) => `the linker placed the code at ${a} instead of ${b}`,
	erroDoMontador: () => 'assembler error',
	terminouComCodigo: (exe, status, saida) => `"${exe}" exited with code ${status}:\n${saida}`,
	naoGerouSaida: exe => `"${exe}" did not create the {out} output file`,

	mapaCabecalho: () => '	offset (hex)	 offset	   size	relative						section',
	mapaLinha: n => `(line ${n})`,
	mapaTotal: (bytes, rotulos, passadas) => `total: ${bytes} bytes · ${rotulos} label(s) · ${passadas} layout pass(es)`,

	ajuda: formatos => `txt2bin — write binary files as plain text

usage:
	txt2bin input.ttb [output] [options]
	txt2bin input.ttb -o output.bin --map

options:
	-o, --out FILE			output file ("-" = standard output)
	-f, --format FMT		${formatos}	 (default: bin)
	--mime TYPE				MIME type for datauri (default application/octet-stream)
	--map					print the map of sections and labels
	--config FILE			assembly backend configuration
							(default: txt2bin.config.json next to the input)
	--architectures			list the <<assembly(...) architectures
	--lang pt|en			message language (default: the system's)
	-h, --help				this help
`,
	precisaValor: op => `${op} needs a value`,
	opcaoDesconhecida: op => `unknown option ${op}`,
	idiomaDesconhecido: i => `unknown language "${i}" (use pt or en)`,
	tambem: lista => `[also: ${lista}]`,
	naoEncontrado: () => 'NOT FOUND',
	formatoDesconhecido: f => `unknown format "${f}"`,
	configNaoEncontrada: arq => `configuration not found: ${arq}`,
	informeSaida: () => 'give an output (a file or "-") or use --map / --format',
	erro: () => 'error',
};

const TABELAS: Record<Idioma, Mensagens> = { pt, en };

/** Idioma a partir de um código de localidade ("pt_BR.UTF-8", "en-US"…). */
export function idiomaDe(localidade: string | undefined): Idioma | undefined {
	if (!localidade || localidade === 'C' || localidade === 'POSIX') return undefined;
	return /^pt\b|^pt[_-]/i.test(localidade) ? 'pt' : 'en';
}

export function detectarIdioma(env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}): Idioma {
	for (const v of [env.TXT2BIN_LANG, env.LC_ALL, env.LC_MESSAGES, env.LANG, env.LANGUAGE?.split(':')[0]]) {
		const i = idiomaDe(v);
		if (i) return i;
	}
	try { return idiomaDe(Intl.DateTimeFormat().resolvedOptions().locale) ?? 'en'; }
	catch { return 'en'; }
}

// O estado fica no globalThis, e não numa variável do módulo: o bun build chega
// a duplicar módulos no pacote (o mesmo problema do ehErroFonte), e com duas
// cópias deste arquivo o definirIdioma() do CLI não chegaria ao conversor.
const CHAVE = Symbol.for('txt2bin.idioma');
const estado: { atual: Idioma } = ((globalThis as Record<symbol, unknown>)[CHAVE] ??= { atual: detectarIdioma() }) as { atual: Idioma };

export function definirIdioma(idioma: Idioma): void {
	if (!(idioma in TABELAS)) throw new Error(TABELAS[estado.atual].idiomaDesconhecido(String(idioma)));
	estado.atual = idioma;
}

export function idioma(): Idioma {
	return estado.atual;
}

/** As mensagens no idioma atual. */
export function msg(): Mensagens {
	return TABELAS[estado.atual];
}
