// Verifica que cada pedaço de um .ttb recebe o escopo (e portanto a cor) certo.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tokenizar } from './gramatica.ts';

/** Escopo de um trecho (a primeira ocorrência na linha indicada, ou em qualquer linha). */
async function escopo(fonte: string, texto: string, linha?: number) {
  const t = (await tokenizar(fonte)).find(t => t.texto === texto && (linha === undefined || t.linha === linha));
  if (!t) throw new Error(`token "${texto}" não encontrado`);
  return t.escopo.replace(/\.txt2bin$/, '');
}

describe('diretivas', () => {
  test('cabeçalho, nome e "+"', async () => {
    const f = '<<uint32+\n1\n';
    expect(await escopo(f, '<<')).toBe('punctuation.definition.directive');
    expect(await escopo(f, 'uint32')).toBe('keyword.control.directive');
    expect(await escopo(f, '+')).toBe('keyword.operator.endianness');
  });
  test('rótulo e comentário de seção', async () => {
    expect(await escopo('<<@fim\n', 'fim')).toBe('entity.name.label');
    expect(await escopo('<<# nota\ncontinua\n<<hex\n00\n', 'continua')).toBe('comment.block.section');
  });
  test('diretiva desconhecida e texto antes da primeira diretiva', async () => {
    expect(await escopo('<<foo\n', 'foo')).toBe('invalid.illegal.directive');
    expect(await escopo('oi\n<<hex\n', 'oi')).toBe('invalid.illegal.before-directive');
  });
});

describe('conteúdo', () => {
  test('texto e escapes', async () => {
    const f = '<<utf8\nOi\\n\\q\n';
    expect(await escopo(f, 'Oi')).toBe('string.unquoted.text');
    expect(await escopo(f, '\\n')).toBe('constant.character.escape');
    expect(await escopo(f, '\\q')).toBe('invalid.illegal.escape');
  });
  test('hex: bytes, comentário e caractere inválido', async () => {
    const f = '<<hex\n0a zz # nota\n';
    expect(await escopo(f, '0a')).toBe('constant.numeric.hex.byte');
    expect(await escopo(f, 'z')).toBe('invalid.illegal.hex');
    expect(await escopo(f, '# nota')).toBe('comment.line.number-sign');
  });
  test('base64: dados e preenchimento', async () => {
    const f = '<<base64\n3q2+7w==\n';
    expect(await escopo(f, '3q2+7w')).toBe('string.other.base64');
    expect(await escopo(f, '=')).toBe('punctuation.definition.padding');
  });
  test('expressões', async () => {
    const f = '<<float32\n(sin(pi/2) * $fim) 0x1F 1.5e3 \'A\' nome\n';
    expect(await escopo(f, 'sin')).toBe('support.function.math');
    expect(await escopo(f, 'pi')).toBe('constant.language');
    expect(await escopo(f, 'fim')).toBe('variable.other.label');
    expect(await escopo(f, '0x1F')).toBe('constant.numeric.hex');
    expect(await escopo(f, '1.5e3')).toBe('constant.numeric.float');
    expect(await escopo(f, "'A'")).toBe('constant.character');
    expect(await escopo(f, '*')).toBe('keyword.operator.arithmetic');
    expect(await escopo(f, 'nome')).toBe('invalid.illegal.identifier');
  });
  test('fill/align: argumentos são expressão; conteúdo é erro', async () => {
    const f = '<<fill 510-$.\nlixo\n';
    expect(await escopo(f, '510')).toBe('constant.numeric.decimal');
    expect(await escopo(f, 'lixo')).toBe('invalid.illegal.content');
  });
});

describe('assembly', () => {
  const f = [
    '<<assembly(avr) mcpu=atmega328p org=0x10',
    'laco: sbi 0x04, 5   ; liga',
    '    ldi r18, ${$fim - 1}',
    '    rjmp laco // volta',
    '<<@fim',
  ].join('\n');
  test('cabeçalho: arquitetura e opções', async () => {
    expect(await escopo(f, 'avr')).toBe('entity.name.type.architecture');
    expect(await escopo(f, 'mcpu')).toBe('variable.parameter.option');
    expect(await escopo(f, 'atmega328p')).toBe('string.unquoted.option');
    expect(await escopo(f, '0x10', 1)).toBe('constant.numeric.hex');
  });
  test('rótulo, mnemônico, registrador, número e comentários', async () => {
    expect(await escopo(f, 'laco', 2)).toBe('entity.name.label.asm');
    expect(await escopo(f, 'sbi')).toBe('keyword.other.mnemonic.asm');
    expect(await escopo(f, 'r18')).toBe('variable.language.register.asm');
    expect(await escopo(f, '0x04')).toBe('constant.numeric.hex.asm');
    expect(await escopo(f, '; liga')).toBe('comment.line.semicolon.asm');
    expect(await escopo(f, '// volta')).toBe('comment.line.double-slash.asm');
  });
  test('${...} vira expressão embutida', async () => {
    expect(await escopo(f, '${')).toBe('punctuation.section.embedded.begin');
    expect(await escopo(f, 'fim', 3)).toBe('variable.other.label');
    expect(await escopo(f, '}')).toBe('punctuation.section.embedded.end');
  });
  test('# do ARM como imediato não é comentário', async () => {
    const t = await tokenizar('<<assembly(arm)\nmov r0, #5\n');
    expect(t.some(x => x.escopo.startsWith('comment'))).toBe(false);
  });
});

describe('exemplos do repositório', () => {
  const dir = join(import.meta.dir, '../../../exemplos');
  for (const f of ['arduino-blink.ttb', 'boot-x86.ttb', 'expressoes.ttb', 'gltf-face.ttb', 'midi.ttb']) {
    test(`${f} não tem nada marcado como inválido`, async () => {
      const ruins = (await tokenizar(readFileSync(join(dir, f), 'utf8'))).filter(t => t.escopos.some(s => s.startsWith('invalid')));
      expect(ruins.map(t => `${t.linha}: ${t.texto}`)).toEqual([]);
    });
  }
});
