// Testa a lógica da extensão (erros, hover, offsets, F12, outline, comandos)
// trocando o módulo "vscode" pela imitação de vscode-falso.ts.
import { beforeAll, describe, expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as falso from './vscode-falso.ts';

mock.module('vscode', () => falso);
const { registro, documento, Position, Range } = falso;
const exemplos = join(import.meta.dir, '../../../exemplos');

/** Abre um documento e roda a análise (o comando "mapa" analisa e mostra o mapa). */
function abrir(nome: string, texto = readFileSync(join(exemplos, nome), 'utf8')) {
  const d = documento(join(exemplos, nome), texto);
  falso.window.activeTextEditor = { document: d };
  registro.comandos['txt2bin.mapa']!();
  return d;
}

beforeAll(async () => {
  const ext = await import('../src/extension.ts');
  ext.activate({ subscriptions: { push() {} } } as never);
});

describe('extensão', () => {
  test('registra provedores e comandos', () => {
    expect(Object.keys(registro.provedores).sort()).toEqual(['definicao', 'hints', 'hover', 'simbolos']);
    expect(Object.keys(registro.comandos).sort()).toEqual(['txt2bin.gerar', 'txt2bin.hex', 'txt2bin.mapa']);
  });

  test('arquivo válido: sem diagnósticos e com o mapa na saída', () => {
    const d = abrir('midi.ttb');
    expect(registro.diagnosticos.get(d.uri.toString())).toEqual([]);
    expect(registro.saida.join('\n')).toContain('total: 62 bytes');
  });

  test('erro vira diagnóstico na linha certa', () => {
    const d = abrir('ruim.ttb', '<<uint8\n1\n(2 +\n');
    const [diag] = registro.diagnosticos.get(d.uri.toString())!;
    expect(diag!.range.start.line).toBe(2);                 // linhas começam em 0 no VS Code
    expect(diag!.message).toBe('"(" sem ")" correspondente');
  });

  test('inlay hints: offset e tamanho de cada cabeçalho', () => {
    const d = abrir('midi.ttb');
    const hints = registro.provedores.hints.provideInlayHints(d, new Range(0, 0, 999, 0));
    const porLinha = Object.fromEntries(hints.map((h: falso.InlayHint) => [h.position.line + 1, h.label]));
    expect(porLinha[11]).toBe('0x4 · 4 B');       // <<uint32+ do tamanho do cabeçalho
    expect(porLinha[23]).toBe('= 0x16');           // <<@ini
  });

  test('hover em $rótulo e em cabeçalho', () => {
    const d = abrir('midi.ttb');
    expect(registro.provedores.hover.provideHover(d, new Position(21, 2)).contents.value).toBe('**$fim** = `62` · `0x3E`');
    expect(registro.provedores.hover.provideHover(d, new Position(20, 3)).contents.value).toContain('offset `18`');
  });

  test('F12 leva ao <<@rótulo', () => {
    const d = abrir('midi.ttb');
    expect(registro.provedores.definicao.provideDefinition(d, new Position(21, 7)).range.line).toBe(22);
  });

  test('outline lista seções e rótulos, sem comentários', () => {
    const d = abrir('midi.ttb');
    const nomes = registro.provedores.simbolos.provideDocumentSymbols(d).map((s: falso.DocumentSymbol) => s.name);
    expect(nomes).toEqual(['utf8', 'uint32+', 'uint16+', 'utf8', 'uint32+', 'ini', 'hex', 'uint8', 'hex', 'fim']);
  });

  test('dump hexadecimal', () => {
    abrir('midi.ttb');
    registro.comandos['txt2bin.hex']!();
    expect(registro.saida[0]).toStartWith('00000000  4d 54 68 64');
  });
});
