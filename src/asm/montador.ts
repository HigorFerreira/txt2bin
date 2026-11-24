import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { ARQUITETURAS, normalizarNome } from './arquiteturas.ts';
import { conteudo, lerElf, SHF_ALLOC, SHT_REL, SHT_RELA } from './elf.ts';

/** Backend definido pelo usuário: qualquer montador que gere binário puro. */
export interface BackendComando {
  /** Comando e argumentos. Marcadores: {in} {out} {org} {org_hex} */
  cmd: string[];
  /** Texto inserido antes do código (aceita os mesmos marcadores). */
  preludio?: string;
  /** Extensão do arquivo de entrada temporário (padrão .s) */
  extensao?: string;
}

export interface Config {
  assembly?: Record<string, BackendComando>;
}

export interface PedidoAsm {
  arquitetura: string;
  codigo: string;
  org: bigint;
  opcoes: Record<string, string>;
  config?: Config;
}

export class ErroAsm extends Error {
  /** linha relativa ao início do código (1-based), se o montador informou */
  constructor(mensagem: string, public linhaRelativa?: number) { super(mensagem); }
}

// ---------------------------------------------------------------------------
// Localização das ferramentas
// ---------------------------------------------------------------------------
const cacheFerramentas = new Map<string, string | null>();

export function acharFerramenta(nome: string, variavel: string): string | null {
  if (cacheFerramentas.has(nome)) return cacheFerramentas.get(nome)!;
  const candidatos: string[] = [];
  if (process.env[variavel]) candidatos.push(process.env[variavel]!);
  const exe = process.platform === 'win32' ? '.exe' : '';
  const dirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  dirs.push('/opt/homebrew/opt/llvm/bin', '/usr/local/opt/llvm/bin', '/opt/homebrew/opt/lld/bin', '/usr/local/opt/lld/bin',
    'C:\\Program Files\\LLVM\\bin');
  const nomes = [nome, ...Array.from({ length: 10 }, (_, k) => `${nome}-${22 - k}`)];
  for (const d of dirs) for (const n of nomes) candidatos.push(join(d, n + exe));
  const achado = candidatos.find(c => existsSync(c)) ?? null;
  cacheFerramentas.set(nome, achado);
  return achado;
}

const DICA_INSTALAR =
  'instale o LLVM: macOS "brew install llvm lld"; Debian/Ubuntu "apt install llvm lld"; ' +
  'Windows "winget install LLVM.LLVM". Ou aponte as variáveis LLVM_MC e LD_LLD para os executáveis.';

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------
const cache = new Map<string, Uint8Array>();

export function montar(p: PedidoAsm): Uint8Array {
  const chave = JSON.stringify([p.arquitetura, p.codigo, String(p.org), p.opcoes, p.config?.assembly?.[p.arquitetura]]);
  const pronto = cache.get(chave);
  if (pronto) return pronto;
  const dir = mkdtempSync(join(tmpdir(), 'txt2bin-'));
  try {
    const personalizado = p.config?.assembly?.[p.arquitetura] ?? p.config?.assembly?.[normalizarNome(p.arquitetura)];
    const bytes = personalizado ? montarComando(p, personalizado, dir) : montarLLVM(p, dir);
    cache.set(chave, bytes);
    return bytes;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Seções de metadados que alguns alvos sempre geram (MIPS, notas): ignoradas. */
const METADADOS = /^\.(reginfo|MIPS\.|note|comment|riscv\.attributes|ARM\.attributes|gnu\.attributes)/;

const FIM = '__txt2bin_fim__';

function comentarioIntel(linha: string): string {
  let aspas: string | null = null;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]!;
    if (aspas) { if (c === '\\') i++; else if (c === aspas) aspas = null; }
    else if (c === '"' || c === "'") aspas = c;
    else if (c === ';') return linha.slice(0, i) + '#' + linha.slice(i + 1);
  }
  return linha;
}

function hexOrg(org: bigint) { return '0x' + org.toString(16); }

function montarLLVM(p: PedidoAsm, dir: string): Uint8Array {
  const nome = normalizarNome(p.arquitetura);
  const arq = ARQUITETURAS[nome];
  if (!arq && !p.opcoes.triple) {
    throw new ErroAsm(`arquitetura desconhecida "${p.arquitetura}". Disponíveis: ${Object.keys(ARQUITETURAS).join(', ')}. ` +
      'Também dá para passar triple=<llvm-triple> ou configurar um backend próprio.');
  }
  const mc = acharFerramenta('llvm-mc', 'LLVM_MC');
  if (!mc) throw new ErroAsm(`llvm-mc não encontrado; ${DICA_INSTALAR}`);

  const triple = p.opcoes.triple ?? arq!.triple;
  const mcpu = p.opcoes.mcpu ?? arq?.mcpu;
  const mattr = p.opcoes.mattr ?? arq?.mattr;

  const preludio: string[] = [];
  let codigo = p.codigo;
  if (arq?.preludio) preludio.push(arq.preludio);
  if (arq?.x86) {
    const sintaxe = (p.opcoes.syntax ?? 'intel').toLowerCase();
    if (sintaxe === 'intel') {
      preludio.push('.intel_syntax noprefix');
      // Na sintaxe Intel (NASM, MASM), ";" começa comentário. No llvm-mc o
      // comentário x86 é "#" e ";" separa instruções; convertemos o primeiro
      // ";" fora de aspas de cada linha.
      codigo = codigo.split('\n').map(comentarioIntel).join('\n');
    } else if (sintaxe !== 'att') throw new ErroAsm(`syntax deve ser intel ou att (recebeu "${sintaxe}")`);
  }
  // Um rótulo no fim marca o tamanho real do código: alguns alvos (MIPS)
  // completam a seção até o alinhamento, e esses bytes não são do usuário.
  const obj = join(dir, 'codigo.o');
  const montarObj = (enchimento: number) => {
    const pre = enchimento ? [...preludio, `.fill ${enchimento}, 1, 0`] : preludio;
    const args = [`-triple=${triple}`, '-filetype=obj', '-o', obj];
    if (mcpu) args.push(`-mcpu=${mcpu}`);
    if (mattr) args.push(`-mattr=${mattr}`);
    const r = spawnSync(mc, args, { input: [...pre, codigo, `${FIM}:`, ''].join('\n'), encoding: 'utf8' });
    if (r.error) throw new ErroAsm(`falha ao executar llvm-mc: ${r.error.message}`);
    if (r.status !== 0) throw erroDoMontador(r.stderr, pre.length);
    const bin = readFileSync(obj);
    return { bin, elf: lerElf(bin) };
  };

  let { bin, elf } = montarObj(0);
  const outras = elf.secoes.filter(s => (s.flags & SHF_ALLOC) !== 0n && s.tamanho > 0 && s.nome !== '.text' && !METADADOS.test(s.nome));
  if (outras.length) {
    throw new ErroAsm(`o código gerou dados fora de .text (${outras.map(s => s.nome).join(', ')}). ` +
      'Escreva tudo na seção padrão, sem .data/.bss/.section.');
  }
  const precisaLigar = elf.secoes.some(s => (s.tipo === SHT_REL || s.tipo === SHT_RELA) && s.tamanho > 0 && /\.text$/.test(s.nome));
  let descartar = 0;

  if (precisaLigar) {
    // Há referências a endereços (absolutos, ou que o montador deixou para o
    // ligador). O ld.lld resolve tudo colocando .text no endereço "org".
    const lld = acharFerramenta('ld.lld', 'LD_LLD');
    if (!lld) throw new ErroAsm(`o código tem relocações e precisa do ld.lld para resolvê-las; ${DICA_INSTALAR}`);
    // O ligador alinha .text; se org não estiver alinhado, ligamos num endereço
    // alinhado abaixo de org e pomos bytes de enchimento antes do código.
    const alin = BigInt(Math.max(1, elf.secoes.find(s => s.nome === '.text')?.alinhamento ?? 1));
    descartar = Number(p.org % alin);
    if (descartar) ({ bin, elf } = montarObj(descartar));
    const saida = join(dir, 'codigo.elf');
    const base = p.org - BigInt(descartar);
    const l = spawnSync(lld, [obj, '-o', saida, `-Ttext=${hexOrg(base)}`, '-e', '0', '-N', '--build-id=none', '-static'], { encoding: 'utf8' });
    if (l.status !== 0) {
      const msg = (l.stderr || l.stdout || '').trim().replace(/^ld\.lld: /gm, '');
      throw new ErroAsm(`ld.lld falhou: ${msg}` + (/undefined symbol/.test(msg) ? ' (rótulo inexistente no código?)' : ''));
    }
    bin = readFileSync(saida);
    elf = lerElf(bin);
    const t = elf.secoes.find(s => s.nome === '.text');
    if (t && t.endereco !== base) throw new ErroAsm(`o ligador pôs o código em ${hexOrg(t.endereco)} em vez de ${hexOrg(base)}`);
  }

  const texto = elf.secoes.find(s => s.nome === '.text');
  if (!texto) return new Uint8Array(0);
  const bytes = conteudo(bin, texto);
  let fim = elf.simbolo(FIM);
  if (fim === undefined) return bytes.subarray(descartar);
  if (precisaLigar) fim -= texto.endereco;
  if (/^thumb/.test(triple)) fim &= ~1n;
  return bytes.subarray(descartar, Math.min(Number(fim), bytes.length));
}

/** Converte "<stdin>:5:3: error: ..." em ErroAsm com a linha do usuário. */
function erroDoMontador(stderr: string, linhasPreludio: number): ErroAsm {
  const m = /<stdin>:(\d+):(\d+): error: (.*)(?:\n(.*)\n(.*))?/.exec(stderr);
  if (!m) return new ErroAsm(stderr.trim() || 'erro do montador');
  const linha = Number(m[1]) - linhasPreludio;
  const detalhe = m[4] !== undefined ? `\n    ${m[4]}\n    ${m[5] ?? ''}` : '';
  return new ErroAsm(`${m[3]}${detalhe}`, linha);
}

function montarComando(p: PedidoAsm, b: BackendComando, dir: string): Uint8Array {
  const entrada = join(dir, 'codigo' + (b.extensao ?? '.s'));
  const saida = join(dir, 'codigo.bin');
  const trocar = (s: string) => s.replaceAll('{in}', entrada).replaceAll('{out}', saida)
    .replaceAll('{org_hex}', hexOrg(p.org)).replaceAll('{org}', String(p.org));
  const preludio = b.preludio ? trocar(b.preludio) : '';
  writeFileSync(entrada, preludio + (preludio && !preludio.endsWith('\n') ? '\n' : '') + p.codigo + '\n');
  const [exe, ...args] = b.cmd.map(trocar);
  const r = spawnSync(exe!, args, { cwd: dir, encoding: 'utf8' });
  if (r.error) throw new ErroAsm(`falha ao executar "${exe}": ${r.error.message}`);
  if (r.status !== 0) throw new ErroAsm(`"${exe}" terminou com código ${r.status}:\n${(r.stderr || r.stdout).trim()}`);
  if (!existsSync(saida)) throw new ErroAsm(`"${exe}" não gerou o arquivo de saída {out}`);
  return Uint8Array.from(readFileSync(saida));
}
