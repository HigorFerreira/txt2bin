export { montar, type Opcoes, type Resultado, type Item } from './montar.ts';
export { avaliar, type Valor, type Contexto } from './expr.ts';
export { formatar, intelHex, mapa, FORMATOS, type Formato } from './saida.ts';
export { ErroFonte, ehErroFonte } from './erros.ts';
export { ARQUITETURAS, APELIDOS } from './asm/arquiteturas.ts';
export type { Config, BackendComando } from './asm/montador.ts';
export { definirIdioma, detectarIdioma, idioma, type Idioma } from './mensagens.ts';

// Nomes em inglês para as mesmas funções
export {
	montar as assemble,
	type Opcoes as Options,
	type Resultado as Result,
} from './montar.ts';
export { formatar as format, mapa as map, FORMATOS as FORMATS } from './saida.ts';
export { ErroFonte as SourceError, ehErroFonte as isSourceError } from './erros.ts';
export { definirIdioma as setLanguage, idioma as language } from './mensagens.ts';
