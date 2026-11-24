# txt2bin — especificação da linguagem

> Referência completa, em português. A apresentação do projeto, em inglês, está no `README.md` da raiz.

Escreva arquivos binários em texto puro, em arquivos `.ttb`. Bytes em hex, texto, base64, números de 8 a 64 bits (little ou big-endian), expressões com rótulos que se resolvem sozinhos e trechos de assembly de mais de 30 arquiteturas, tudo no mesmo arquivo.

```text
<<utf8
MThd
<<uint32+
6
<<uint16+
0 1 96
<<assembly(avr)
laco: rjmp laco
```

```sh
bun install
bun src/cli.ts exemplos/midi.ttb arpejo.mid --map
```

---

## Sumário

1. [A sintaxe](#1-a-sintaxe)
2. [Diretivas](#2-diretivas)
3. [Ordem de bytes](#3-ordem-de-bytes-little-e-big-endian)
4. [Texto e escapes](#4-texto-e-escapes)
5. [Números e expressões](#5-números-e-expressões)
6. [Rótulos e layout](#6-rótulos-e-layout)
7. [Assembly](#7-assembly)
8. [Linha de comando](#8-linha-de-comando)
9. [API](#9-api)
10. [Exemplos](#10-exemplos)
11. [Editor (VS Code)](#11-editor-vs-code)
12. [Desenvolvimento](#12-desenvolvimento)

---

## 1. A sintaxe

Um arquivo é uma sequência de **seções**. Cada seção começa com `<<` **na coluna 0** de uma linha, seguido da diretiva e, opcionalmente, de argumentos na mesma linha. O conteúdo da seção vai da linha seguinte até a próxima diretiva ou o fim do arquivo.

```text
<<diretiva argumentos
conteúdo
conteúdo
<<outra
...
```

`<<` no meio de uma linha é conteúdo comum. Por isso os operadores `<<` e `>>` funcionam nas expressões. Para que uma linha de texto **comece** com `<<`, escape o primeiro `<`: `\<<`.

Texto antes da primeira diretiva é erro (exceto linhas em branco).

## 2. Diretivas

| diretiva | conteúdo | bytes gerados |
|---|---|---|
| `<<utf8` | texto; quebras de linha reais são ignoradas | UTF-8 |
| `<<utf16` / `<<utf16+` | texto | UTF-16 LE / BE |
| `<<hex` | dígitos hex; espaços e quebras ignorados; `#` comenta | os bytes |
| `<<base64` | base64 padrão (`+` `/`); preenchimento `=` opcional | os bytes |
| `<<base64url` | base64url (`-` `_`); preenchimento `=` opcional | os bytes |
| `<<uint8` `<<int8` | valores (expressões) | 1 byte cada |
| `<<uint16` `<<int16` `<<float16` | valores | 2 bytes cada |
| `<<uint32` `<<int32` `<<float32` | valores | 4 bytes cada |
| `<<uint64` `<<int64` `<<float64` | valores | 8 bytes cada |
| `<<align N [HH]` | — | enche com `HH` (padrão `00`) até o offset ser múltiplo de `N` |
| `<<fill N [HH]` | — | `N` bytes `HH` (`N` é uma expressão) |
| `<<@nome` | — | nada; define o rótulo `$nome` |
| `<<#` | qualquer coisa | nada (comentário) |
| `<<assembly(arq) [opções]` | código assembly | o código de máquina |

Nas seções `hex`, `base64`, `base64url` e numéricas, `#` começa um comentário até o fim da linha. Em `utf8`/`utf16` o `#` é texto, e em `assembly` vale a sintaxe de comentário do montador.

## 3. Ordem de bytes (little e big-endian)

**A ordem de bytes só existe para valores de mais de um byte.** Um número de 32 bits ocupa quatro bytes, e a pergunta é qual vai primeiro: o menos significativo (little-endian, `0x01020304` → `04 03 02 01`) ou o mais significativo (big-endian → `01 02 03 04`).

| diretiva | tem ordem? | por quê |
|---|---|---|
| `hex`, `base64`, `base64url` | não | já são uma sequência de bytes |
| `utf8` | não | a unidade do UTF-8 é o byte |
| `uint8`, `int8` | não | um byte só (o `+` é aceito e não faz nada) |
| números de 16, 32 e 64 bits | **sim** | `+` = big-endian |
| `utf16` | **sim** | a unidade tem 2 bytes; `+` = UTF-16BE |
| `assembly` | é a da arquitetura | o montador decide (`mips` é BE, `mipsel` é LE) |

O padrão é **little-endian** porque é a ordem nativa de x86, ARM, RISC-V e AVR, e a exigida por glTF, WAV, BMP, ZIP e pela maioria dos formatos modernos. Formatos de rede e vários formatos antigos são big-endian: PNG, JPEG, MIDI, Java `.class`, cabeçalhos TCP/IP. Para esses, use `+`:

```text
<<uint32+
0x89504E47      # 89 50 4E 47
```

Usar `+` numa diretiva sem ordem de bytes (`<<hex+`, `<<utf8+`, `<<assembly(x)+`) é erro, para não dar a impressão de que algo mudou.

## 4. Texto e escapes

Em `<<utf8` e `<<utf16`, as quebras de linha do arquivo-fonte são ignoradas: a linha seguinte é grudada na anterior. Espaços são mantidos.

| escape | resultado |
|---|---|
| `\n` `\r` `\t` | quebra de linha, retorno de carro, tabulação |
| `\0` | byte zero (terminador de string C) |
| `\s` | espaço (útil no fim da linha, onde ele ficaria invisível) |
| `\\` | barra invertida |
| `\<` | `<` (necessário só para começar uma linha com `<<`) |
| `\u{HHHH}` | caractere Unicode pelo código |

## 5. Números e expressões

Nas seções numéricas, os valores são separados por espaços ou quebras de linha. **Um valor pode ser uma expressão.** Sem espaços ela pode ser escrita direto; com espaços, entre parênteses:

```text
<<uint16
$fim-$ini   (($fim - $ini) / 4)   0x7FFF   'A'
<<float32
(sin(pi/6))  1.5e-3  (sqrt(2) / 2)
```

Escrever `1 + 2` sem parênteses é erro, com uma mensagem dizendo isso. Assim um espaço esquecido não vira silenciosamente três valores.

**Literais:** `42`, `-7`, `1_000_000`, `0xFF`, `0b1010`, `0o17`, `1.5`, `2e-3`, `'A'` (código do caractere; aceita `'\n'`, `'\''`, `'\\'`, `'\0'`).

**Operadores**, da menor para a maior precedência (a mesma do Python):

| operadores | |
|---|---|
| `\|` | ou bit a bit |
| `^` | ou exclusivo |
| `&` | e bit a bit |
| `<<` `>>` | deslocamentos |
| `+` `-` | |
| `*` `/` `//` `%` | `/` divisão, `//` divisão inteira (arredonda para baixo), `%` módulo (sinal do divisor) |
| `-x` `+x` `~x` | unários |
| `**` | potência (associa à direita: `2**3**2` = 512; `-2**2` = −4) |

**Inteiros exatos.** Literais inteiros são inteiros de precisão arbitrária, e as contas continuam exatas enquanto possível. `0xFFFF_FFFF_FFFF_FFFF` cabe em `uint64` sem perder nenhum bit. A divisão `/` entre inteiros dá inteiro quando é exata (`10/2` = 5) e real quando não é (`10/4` = 2.5). Numa seção inteira, o valor final precisa ser inteiro: `(10/4)` em `<<uint8` é erro, e `floor(10/4)` ou `10//4` resolvem.

**Funções:** `sin cos tan asin acos atan atan2 sqrt cbrt exp log log2 log10 hypot rad deg abs min max floor ceil round trunc int float`.

**Constantes:** `pi`, `tau`, `e`, `inf`, `nan`.

**Rótulos:** `$nome` é o offset do rótulo no arquivo; `$.` é o offset do próprio valor sendo escrito.

## 6. Rótulos e layout

`<<@nome` marca uma posição. O rótulo pode ser usado antes de ser definido:

```text
<<uint32
$fim-$ini         # tamanho do bloco, calculado sozinho
<<@ini
<<utf8
{"asset":{"version":"2.0"}}
<<align 4 20
<<@fim
```

**Layout em ponto fixo.** O tamanho de algumas seções depende de rótulos: `<<fill 510-($.-$inicio)`, ou um `jmp` cujo tamanho depende da distância até o alvo. E os rótulos dependem dos tamanhos. O txt2bin começa com todos os rótulos em 0 e recalcula até nada mudar (no máximo 32 passadas). O `--map` mostra quantas passadas foram necessárias.

## 7. Assembly

```text
<<assembly(x86_64)
    xor edi, edi        ; comentário
    mov eax, 60
    syscall
```

O backend padrão é o **LLVM**: `llvm-mc` monta o código para a arquitetura pedida e o txt2bin extrai os bytes da seção `.text`. Se o código tiver referências a endereços (endereços absolutos, saltos que o montador deixa para o ligador), o `ld.lld` liga o código no endereço `org` antes da extração.

Instalação do LLVM:

| sistema | comando |
|---|---|
| macOS | `brew install llvm lld` |
| Debian/Ubuntu | `apt install llvm lld` |
| Windows | `winget install LLVM.LLVM` |

Os executáveis são procurados no `PATH`, com sufixos de versão (`llvm-mc-18`) e nos caminhos do Homebrew. Também dá para indicar os caminhos com as variáveis `LLVM_MC` e `LD_LLD`. O comando `txt2bin --arquiteturas` (ou `--architectures`) mostra o que foi encontrado.

### Arquiteturas

| nome | descrição | apelidos |
|---|---|---|
| `x86_16` | x86 16 bits (modo real, 8086, setor de boot) | `8086`, `real`, `x86_real`, `i8086` |
| `x86` | x86 32 bits (IA-32) | `intel_x86`, `i386`, `i686`, `ia32`, `x86_32` |
| `x86_64` | x86-64 (AMD64 / Intel 64) | `amd64`, `x64`, `intel_x64`, `intel_x86_64` |
| `arm` | ARM 32 bits, instruções A32 (ARMv7-A) | `armv7`, `a32`, `arm32` |
| `armeb` | ARM 32 bits big-endian | |
| `thumb` | Thumb-2 (ARMv7-A) | `t32` |
| `cortex_m0` | ARM Cortex-M0/M0+ (RP2040, STM32F0) | `rp2040` |
| `cortex_m3` | ARM Cortex-M3 (STM32F1) | `stm32` |
| `cortex_m4` | ARM Cortex-M4 (STM32F4, nRF52) | |
| `cortex_m33` | ARM Cortex-M33 (RP2350, nRF5340) | |
| `arm64` | ARM 64 bits (AArch64 / ARMv8-A) | `aarch64`, `armv8` |
| `apple_silicon` | Apple Silicon (M1 em diante) | `apple`, `apple_m1`, `m1` |
| `avr` | Atmel/Microchip AVR (padrão ATmega328P; use `mcpu=`) | `atmel`, `atmega`, `arduino` |
| `msp430` | TI MSP430 | |
| `xtensa` | Xtensa (ESP32, ESP8266), experimental no LLVM | `esp32` |
| `riscv32` / `riscv64` | RISC-V RV32GC / RV64GC | `rv32` / `riscv`, `rv64` |
| `mips` `mipsel` `mips64` `mips64el` | MIPS 32/64, big/little-endian | |
| `ppc` `ppc64` `ppc64le` | PowerPC | `powerpc`, `powerpc64` |
| `sparc` `sparcv9` | SPARC | |
| `s390x` | IBM Z | `systemz`, `s390` |
| `m68k` | Motorola 68000, experimental (faltam instruções como `moveq`) | `68000`, `68k` |
| `loongarch64` | LoongArch | `loongarch` |
| `hexagon` | Qualcomm Hexagon | |
| `bpf` | eBPF | `ebpf` |

Hífens e maiúsculas não importam: `Intel-X86` = `intel_x86`. Qualquer outro alvo do LLVM pode ser usado com `triple=`.

### Opções

| opção | efeito |
|---|---|
| `org=EXPR` | endereço onde o código vai rodar (padrão: o offset da seção no arquivo). Aceita rótulos. |
| `mcpu=NOME` | processador (`mcpu=attiny85`, `mcpu=cortex-m7`, `mcpu=apple-m3`) |
| `mattr=LISTA` | extensões (`mattr=+avx2`, `mattr=+m,+c`) |
| `triple=TRIPLE` | triple do LLVM, para alvos fora da tabela |
| `syntax=intel\|att` | só x86; padrão `intel` |

### Valores do arquivo dentro do código: `${...}`

Dentro de uma seção `assembly`, `${expressão}` é trocado pelo valor da expressão antes da montagem:

```text
<<assembly(x86_64)
    mov ecx, ${$fim - $dados}     ; tamanho dos dados
<<@dados
<<utf8
...
<<@fim
```

Usamos `${...}` e não `$nome` porque o `$` já tem significado em várias sintaxes de assembly: imediatos no AT&T (`$60`) e registradores no MIPS (`$t0`).

### Particularidades

- **x86 na sintaxe Intel:** `;` começa comentário, como no NASM e no MASM (o txt2bin converte para o `#` do LLVM). Para carregar o **endereço** de um rótulo, escreva `mov si, offset msg`. `mov si, msg` lê a memória nesse endereço, como no MASM.
- **MIPS:** o montador preenche os *delay slots* com `nop` automaticamente. Use `.set noreorder` para controlá-los à mão.
- **Uma seção só:** o código deve ficar na seção padrão. Dados com `.byte`/`.ascii` funcionam; `.data`, `.bss` e `.section` são recusados.
- **Endereços fora de `org`:** `org` não precisa estar alinhado. Se o ligador exigir alinhamento, o txt2bin compensa e entrega os bytes certos para o endereço pedido.

### Backends próprios: qualquer montador

Para arquiteturas fora do LLVM (Z80, 6502, 8051, PIC), ou para usar o NASM, crie um `txt2bin.config.json` ao lado do arquivo-fonte (ou passe `--config`):

```json
{
  "assembly": {
    "z80":    { "cmd": ["sjasmplus", "--nologo", "--raw={out}", "{in}"], "preludio": "  org {org}", "extensao": ".asm" },
    "nasm16": { "cmd": ["nasm", "-f", "bin", "-o", "{out}", "{in}"], "preludio": "bits 16\norg {org}", "extensao": ".asm" }
  }
}
```

O txt2bin escreve o código num arquivo temporário (`{in}`), roda o comando e lê o binário de `{out}`. Os marcadores `{org}` e `{org_hex}` trazem o endereço. Um nome definido na configuração tem prioridade sobre a tabela interna.

## 8. Linha de comando

```text
txt2bin entrada.ttb [saida] [opções]

  -o, --out ARQ       arquivo de saída ("-" = saída padrão)
  -f, --format FMT    bin | hex | base64 | base64url | datauri | ihex
  --mime TIPO         tipo MIME do datauri
  --map               mapa de seções e rótulos (na saída de erro)
  --config ARQ        backends de assembly
  --arquiteturas      lista as arquiteturas e onde está o LLVM (também --architectures)
  --lang pt|en        idioma das mensagens (padrão: o do sistema)
```

`ihex` é o formato Intel HEX, o que o `avrdude` e muitos gravadores de microcontrolador esperam. Os erros vêm como `arquivo:linha: mensagem`, inclusive os do montador, com a linha traduzida para o arquivo-fonte.

**Idioma.** Mensagens, ajuda e mapa saem em português ou inglês. A ordem de escolha é: `--lang`; a variável `TXT2BIN_LANG`; o idioma do sistema (`LC_ALL`, `LC_MESSAGES`, `LANG`, `LANGUAGE`). Português se começar com `pt`, inglês nos demais casos.

## 9. API

```ts
import { montar, formatar, mapa } from 'txt2bin';

const r = montar(fonte, { config });   // { bytes, itens, rotulos, passadas }
r.bytes;                               // Uint8Array
r.rotulos.get('fim');                  // bigint
formatar(r.bytes, 'ihex');             // string
console.log(mapa(r));
```

Os erros são `ErroFonte`, com `.linha` e `.formatar(nomeDoArquivo)`. Use `ehErroFonte(e)` para testar, e não `instanceof`.

`definirIdioma('pt' | 'en')` fixa o idioma das mensagens. As funções também têm nomes em inglês: `assemble`, `format`, `map`, `SourceError`, `isSourceError`, `setLanguage`.

## 10. Exemplos

| arquivo | o que mostra |
|---|---|
| `exemplos/gltf-face.ttb` | GLB completo; idêntico byte a byte ao gerado pela versão JS |
| `exemplos/midi.ttb` | formato big-endian (`+`), tamanho de chunk por rótulos, VLQ com operadores de bits |
| `exemplos/pdf-minimo.ttb` | PDF de uma página; offsets da tabela xref e `/Length` escritos como texto decimal, dígito a dígito, a partir dos rótulos |
| `exemplos/boot-x86.ttb` | setor de boot: `assembly(x86_16)` com `org`, texto e `fill` até o byte 510 |
| `exemplos/arduino-blink.ttb` | AVR para o Arduino Uno, saída em Intel HEX |
| `exemplos/expressoes.ttb` | tabelas calculadas com `sin`/`cos`, divisões, máscaras |
| `exemplos/txt2bin.config.json` | backends próprios: NASM, Z80 (sjasmplus), 6502 (vasm) |

## 11. Editor (VS Code)

A extensão em `editores/vscode/` reconhece arquivos `.ttb` e oferece:

- realce de sintaxe, inclusive dentro do assembly e das expressões `${...}`;
- erros enquanto você digita, na linha certa;
- offset e tamanho de cada seção ao fim da linha `<<diretiva`;
- valor dos rótulos ao passar o mouse, F12 para ir à definição, Outline;
- comandos para gerar o binário, ver o mapa e o dump hexadecimal; snippets.

```sh
cd editores/vscode && bun install && bun run package
code --install-extension txt2bin-vscode-0.1.0.vsix
```

A gramática (`syntaxes/txt2bin.tmLanguage.json`) é TextMate, o mesmo formato usado pelo GitHub (Linguist), Sublime Text, Shiki e outros editores, então pode ser reaproveitada.

## 12. Desenvolvimento

```sh
bun install
bun test              # testes (os de assembly são pulados sem LLVM)
bun run typecheck
bun run build         # dist/ para o npm (roda em Node ≥ 18 e em Bun)
bun run compile       # executável único em dist/txt2bin
```

O código-fonte é TypeScript e roda direto no Bun. O pacote publicado leva `dist/` (JavaScript para Node) e `src/` (que o Bun usa direto, pela condição `bun` do `exports`).

```text
src/
  secoes.ts      separa as seções e lê os cabeçalhos
  expr.ts        expressões: léxico, sintaxe, aritmética bigint/real
  codificar.ts   tipos numéricos, float16, texto, hex, base64
  montar.ts      interpretação, layout em ponto fixo, emissão
  saida.ts       formatos de saída, Intel HEX, mapa
  asm/
    arquiteturas.ts   tabela de alvos e apelidos
    montador.ts       llvm-mc, ld.lld e backends por comando
    elf.ts            leitor de ELF (seções e símbolos)
  cli.ts, index.ts
editores/vscode/   extensão do VS Code (gramática, diagnósticos, hover)
```
