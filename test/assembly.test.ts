import { describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { montar, ErroFonte, type Config } from '../src/index.ts';
import { acharFerramenta } from '../src/asm/montador.ts';

const temLLVM = !!acharFerramenta('llvm-mc', 'LLVM_MC') && !!acharFerramenta('ld.lld', 'LD_LLD');
const hex = (fonte: string, config?: Config) => Buffer.from(montar(fonte, { config }).bytes).toString('hex');

describe.skipIf(!temLLVM)('assembly via LLVM', () => {
  test('x86-64 (sintaxe Intel por padrão)', () => {
    expect(hex('<<assembly(x86_64)\nxor rdi, rdi\nmov eax, 60\nsyscall\n')).toBe('4831ffb83c0000000f05');
  });
  test('x86-64 em sintaxe AT&T', () => {
    expect(hex('<<assembly(x86_64) syntax=att\nmovl $60, %eax\n')).toBe('b83c000000');
  });
  test('apelidos: intel_x86, atmel, apple_silicon', () => {
    expect(hex('<<assembly(intel_x86)\nnop\n')).toBe('90');
    expect(hex('<<assembly(atmel)\nnop\n')).toBe('0000');
    expect(hex('<<assembly(apple_silicon)\nret\n')).toBe('c0035fd6');
  });
  test('AArch64, ARM, Thumb, RISC-V, AVR', () => {
    expect(hex('<<assembly(arm64)\nmov x0, #42\n')).toBe('400580d2');
    expect(hex('<<assembly(arm)\nlaco: b laco\n')).toBe('feffffea');
    expect(hex('<<assembly(cortex_m0)\nlaco: b laco\n')).toBe('fee7');
    expect(hex('<<assembly(riscv64)\nli a0, 42\n')).toBe('1305a002');
    expect(hex('<<assembly(avr)\nlaco: rjmp laco\n')).toBe('ffcf');
  });
  test('big-endian (PowerPC, MIPS) e sem enchimento de seção', () => {
    expect(hex('<<assembly(ppc)\nblr\n')).toBe('4e800020');
    expect(hex('<<assembly(mips)\naddiu $t0, $t0, 1\n')).toBe('25080001');
  });
  test('org e endereços absolutos (setor de boot)', () => {
    const r = montar('<<assembly(x86_16) org=0x7c00\nmov si, offset msg\nmsg: nop\n');
    expect(Buffer.from(r.bytes).toString('hex')).toBe('be037c90');
  });
  test('org padrão é o offset no arquivo', () => {
    const r = montar('<<hex\n00 00\n<<assembly(x86_16)\nmov si, offset aqui\naqui: nop\n');
    expect(Buffer.from(r.bytes).toString('hex')).toBe('0000' + 'be0500' + '90');
  });
  test('${expressão} com rótulos do arquivo', () => {
    const r = montar('<<assembly(x86_64)\nmov eax, ${$fim - $ini}\n<<@ini\n<<utf8\nabcde\n<<@fim\n');
    expect(Buffer.from(r.bytes.subarray(0, 5)).toString('hex')).toBe('b805000000');
  });
  test('tamanho do código depende de rótulo (layout em ponto fixo)', () => {
    // o "mov" muda de tamanho conforme o imediato cabe ou não em 8 bits
    const fonte = '<<assembly(x86_64)\nadd rax, ${$fim}\n<<fill 200\n<<@fim\n';
    const r = montar(fonte);
    expect(r.bytes.length).toBe(6 + 200);
    expect(r.rotulos.get('fim')).toBe(206n);
  });
  test('erro com a linha do arquivo', () => {
    try { montar('<<hex\n00\n<<assembly(x86_64)\nnop\nmov rax, rbx, rcx\n'); throw new Error('não falhou'); }
    catch (e) {
      expect(e).toBeInstanceOf(ErroFonte);
      expect((e as ErroFonte).linha).toBe(5);
    }
  });
  test('arquitetura desconhecida lista as disponíveis', () => {
    expect(() => montar('<<assembly(z80)\nnop\n')).toThrow(/Disponíveis: x86_16/);
  });
});

const temNasm = spawnSync('nasm', ['-v']).status === 0;
describe.skipIf(!temNasm)('backend por comando', () => {
  test('nasm configurado pelo usuário', () => {
    const config: Config = {
      assembly: { nasm16: { cmd: ['nasm', '-f', 'bin', '-o', '{out}', '{in}'], preludio: 'bits 16\norg {org}', extensao: '.asm' } },
    };
    expect(hex('<<hex\n00\n<<assembly(nasm16)\nmov si, msg\nmsg: db "A"\n', config)).toBe('00' + 'be0400' + '41');
  });
});
