#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ARQUITETURAS, APELIDOS } from './asm/arquiteturas.ts';
import { acharFerramenta, type Config } from './asm/montador.ts';
import { ehErroFonte } from './erros.ts';
import { montar } from './montar.ts';
import { FORMATOS, formatar, mapa, type Formato } from './saida.ts';

const AJUDA = `txt2bin — escreva arquivos binários em texto puro

uso:
  txt2bin entrada.ttb [saida] [opções]
  txt2bin entrada.ttb -o saida.bin --map

opções:
  -o, --out ARQ       arquivo de saída ("-" = saída padrão)
  -f, --format FMT    ${FORMATOS.join(' | ')}   (padrão: bin)
  --mime TIPO         tipo MIME do datauri (padrão application/octet-stream)
  --map               mostra o mapa de seções e rótulos
  --config ARQ        configuração de backends de assembly
                      (padrão: txt2bin.config.json ao lado da entrada)
  --arquiteturas      lista as arquiteturas de <<assembly(...)
  -h, --help          esta ajuda
`;

function main(argv: string[]): number {
  const pos: string[] = [];
  const op: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const comValor = (nome: string) => { const v = argv[++i]; if (v === undefined) throw new Error(`${a} precisa de um valor`); op[nome] = v; };
    if (a === '-o' || a === '--out') comValor('out');
    else if (a === '-f' || a === '--format') comValor('format');
    else if (a === '--mime') comValor('mime');
    else if (a === '--config') comValor('config');
    else if (a === '--map') op.map = true;
    else if (a === '--base64') op.format = 'datauri';           // compatibilidade com a versão JS
    else if (a === '--arquiteturas') op.arquiteturas = true;
    else if (a === '-h' || a === '--help') op.help = true;
    else if (a.startsWith('-') && a !== '-') throw new Error(`opção desconhecida ${a}`);
    else pos.push(a);
  }

  if (op.help) { process.stdout.write(AJUDA); return 0; }
  if (op.arquiteturas) {
    const ap = (n: string) => Object.entries(APELIDOS).filter(([, v]) => v === n).map(([k]) => k);
    for (const [n, a] of Object.entries(ARQUITETURAS)) {
      const al = ap(n);
      console.log(`  ${n.padEnd(14)} ${a.descricao}${al.length ? `  [também: ${al.join(', ')}]` : ''}`);
    }
    console.log(`\n  llvm-mc: ${acharFerramenta('llvm-mc', 'LLVM_MC') ?? 'NÃO ENCONTRADO'}`);
    console.log(`  ld.lld:  ${acharFerramenta('ld.lld', 'LD_LLD') ?? 'NÃO ENCONTRADO'}`);
    return 0;
  }

  const [entrada, saidaPos] = pos;
  if (!entrada) { process.stderr.write(AJUDA); return 1; }
  const saida = (op.out as string | undefined) ?? saidaPos;
  const formato = (op.format as Formato | undefined) ?? 'bin';
  if (!FORMATOS.includes(formato)) throw new Error(`formato desconhecido "${formato}"`);

  let config: Config | undefined;
  const arqConfig = (op.config as string | undefined) ?? join(dirname(entrada), 'txt2bin.config.json');
  if (existsSync(arqConfig)) config = JSON.parse(readFileSync(arqConfig, 'utf8'));
  else if (op.config) throw new Error(`configuração não encontrada: ${arqConfig}`);

  const fonte = readFileSync(entrada, 'utf8');
  let r;
  try {
    r = montar(fonte, { config });
  } catch (e) {
    if (ehErroFonte(e)) { process.stderr.write(`erro: ${e.formatar(entrada)}\n`); return 1; }
    throw e;
  }

  const dados = formatar(r.bytes, formato, op.mime as string | undefined);
  if (saida && saida !== '-') {
    writeFileSync(saida, dados);
    process.stderr.write(`${saida}: ${r.bytes.length} bytes\n`);
  } else if (saida === '-' || formato !== 'bin') {
    process.stdout.write(dados);
  } else if (!op.map) {
    throw new Error('informe a saída (arquivo ou "-") ou use --map / --format');
  }
  if (op.map) process.stderr.write(mapa(r) + '\n');
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  process.stderr.write(`erro: ${(e as Error).message}\n`);
  process.exitCode = 1;
}
