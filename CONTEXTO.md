# CONTEXTO.md — história e decisões do txt2bin

> Documento de contexto para pessoas e agentes de IA que trabalham neste repositório.
> Conta **de onde o projeto veio**, **o que já foi decidido e por quê**, **o que foi verificado**
> e **o que está em aberto**. A especificação da linguagem está no `README.md`; aqui fica o
> raciocínio por trás dela. Ao mudar uma decisão registrada aqui, atualize este arquivo.

- Autor: Higor (Goiânia, GO). Idioma do projeto: **português do Brasil** (código, mensagens de erro, documentação).
- Período coberto: 23 e 24 de novembro de 2026 (uma única conversa de concepção com o Claude).
- Estado no fim desse período: versão `0.2.0`, 47 testes passando, extensão do VS Code `0.1.0` empacotada, nada publicado ainda.

---

## Sumário

1. [Linha do tempo](#1-linha-do-tempo)
2. [O que é o projeto hoje](#2-o-que-é-o-projeto-hoje)
3. [Decisões de projeto e seus motivos](#3-decisões-de-projeto-e-seus-motivos)
4. [Arquitetura do código](#4-arquitetura-do-código)
5. [Assembly: como funciona e o que foi testado](#5-assembly-como-funciona-e-o-que-foi-testado)
6. [Extensão do VS Code](#6-extensão-do-vs-code)
7. [Projetos parecidos (pesquisa)](#7-projetos-parecidos-pesquisa)
8. [Limitações conhecidas e armadilhas](#8-limitações-conhecidas-e-armadilhas)
9. [Pendências e ideias](#9-pendências-e-ideias)
10. [Guia para agentes de IA](#10-guia-para-agentes-de-ia)

---

## 1. Linha do tempo

### Origem: um armário e um estudo de glTF (23/11)

O projeto nasceu de forma indireta.

1. **O armário.** Higor queria projetar um armário com rodinhas para montar dentro de um apartamento, com as peças subindo pelo elevador. Comparamos Fusion, SolidWorks, SketchUp, Promob e FreeCAD. A escolha foi um **modelo paramétrico em código (build123d + OCP CAD Viewer)**, que gera a lista de corte, as ferragens, o peso de cada peça e as validações do prédio. Esse script exportava `armario.glb`.
2. **O estudo de glTF.** Para entender o `.glb`, Higor quis **escrever arquivos glTF à mão, byte a byte**. Para isso propôs um formato de texto simples:

   ```text
   <<utf8
   Coisas em strings escritas, json etc\n
   <<hex
   04ff2345ab5f2c
   <<uint8
   19
   ```

   As regras originais, nas palavras dele: "`<<` + o que será escrito + quebra de linha + conteúdo até o fim do arquivo ou outro `<<`"; "as quebras de linha são escapadas com `\n`; na conversão as quebras de linha são ignoradas e o próximo byte é imediatamente anexado"; "então precisamos de escape para `<`".
3. **A versão 1 (JavaScript, Node).** Foi feito o `txt2bin.js` (sem dependências). Ele foi além do pedido com `<<float32` (indispensável para vértices), `<<align N HH`, rótulos `<<@nome`, expressões `$a-$b`, comentários `#` e `<<#`, e as opções `--map`/`--base64`. Junto vieram um guia em Typst ("glTF do zero", 25 páginas), um visualizador `viewer.html` (three.js com inspetor de chunks, accessors e hex) e 5 exemplos (face, cubo, esfera, spline, mesa com vaso). Todos os exemplos passaram no validador oficial da Khronos. Esse material está no projeto de estudo `gltf-do-zero`, separado deste repositório.

### O formato vira projeto (24/11, manhã)

Higor percebeu que **o formato e o conversor eram interessantes por si só** e pediu:

- reescrever em **TypeScript para rodar no Bun**;
- `<<base64` e `<<base64url`;
- **operações aritméticas**;
- **big-endian com `+`** nos numéricos (ex.: `<<float32+`), depois de perguntar por que tudo era little-endian e se a ordem de bytes só valia para números;
- `<<assembly(<tipo>)` "para todos os tipos de assembly: intel_x86, apple silicon, arm, atmel etc.";
- uma pesquisa sobre formatos parecidos, porque ele pretende **criar um repositório e publicar no npm**.

Resultado: a versão `0.2.0` deste repositório (seções 2 a 5).

### Editor (24/11, fim da manhã)

Higor pediu realce de sintaxe no VS Code e, no meio do trabalho, definiu: **"O arquivo de nossa sintaxe pode ser um `.ttb`"**. Foi feita a extensão em `editores/vscode/` (seção 6), e os exemplos foram renomeados para `.ttb`.

### Este documento (24/11, tarde)

Higor pediu um "arquivão de contexto" para mapear a história e servir de apoio aos agentes de IA. É este arquivo.

---

## 2. O que é o projeto hoje

Uma linguagem de texto (arquivos `.ttb`) e um conversor que gera o binário. O mesmo arquivo pode ter bytes hex, texto UTF-8/UTF-16, base64, números de 8 a 64 bits em little ou big-endian, expressões com rótulos resolvidos automaticamente e trechos de assembly de mais de 30 arquiteturas.

| peça | onde | estado |
|---|---|---|
| biblioteca + CLI | `src/` | TypeScript; roda direto no Bun; `bun run build` gera `dist/` para Node ≥ 18 |
| testes | `test/` | 47 testes (`bun test`); os de assembly são pulados sem LLVM e o do NASM sem `nasm` |
| exemplos | `exemplos/*.ttb` | glTF, MIDI, setor de boot x86, Arduino (AVR), expressões; os testes conferem o SHA-256 de cada um |
| extensão VS Code | `editores/vscode/` | gramática TextMate + diagnósticos + hover + offsets; `.vsix` gerado com `bun run package` |
| especificação | `README.md` | é a referência da linguagem |

Ambiente onde tudo foi desenvolvido e testado: Bun 1.4, LLVM 18.1 (Ubuntu), `ld.lld`, NASM, Node.

---

## 3. Decisões de projeto e seus motivos

Cada item traz **a decisão**, **o motivo** e, quando houve, **a alternativa descartada**.

### 3.1 Sintaxe das seções

- **Uma diretiva é `<<` na coluna 0 da linha.** Na v1 (JS), `<<` em qualquer posição abria uma diretiva. A regra mudou na v2 para que os operadores `<<` e `>>` funcionem nas expressões. `<<` no meio da linha agora é conteúdo comum, e o escape `\<<` só é necessário para uma linha de texto que **comece** com `<<`. *Essa mudança foi comunicada ao Higor como algo que ele deveria aprovar; não houve objeção registrada.*
- **Cabeçalho:** `<<nome(param)+ argumentos`, e o corpo vai até a próxima diretiva. Formas especiais: `<<@rotulo` e `<<# comentário`.
- **Texto antes da primeira diretiva é erro** (linhas em branco são aceitas).

### 3.2 Texto

- Em `utf8`/`utf16`, **as quebras de linha reais são ignoradas** (requisito original). Os espaços são mantidos, inclusive a indentação; num JSON isso não importa.
- Escapes: `\n \r \t \0 \s \\ \< \u{HHHH}`. O `\s` existe porque um espaço no fim da linha fica invisível.
- **Não há comentários em seções de texto**: o `#` é texto. Para comentar, use `<<#`.

### 3.3 Ordem de bytes

- **O padrão é little-endian**: é o que o glTF exige, é a ordem nativa de x86/ARM/RISC-V/AVR e é usada por WAV, BMP, ZIP.
- **A ordem de bytes só existe para unidades de mais de um byte.** Por isso o `+` (big-endian, proposto pelo Higor) vale nos números de 16/32/64 bits e também no **`utf16+`** (UTF-16BE), que foi acrescentado justamente para responder à pergunta dele.
- `+` em `uint8`/`int8` é aceito e não faz nada. `+` em `hex`, `utf8`, `base64` ou `assembly` **é erro**, para não dar a impressão de que algo mudou. No assembly, a ordem é a da arquitetura (`mips` BE, `mipsel` LE).

### 3.4 Números e expressões

- Tipos: `uint8/16/32/64`, `int8/16/32/64`, `float16/32/64`. O `float16` tem conversão própria (IEEE 754 binary16 com arredondamento para o par mais próximo), porque `DataView.setFloat16` não é garantido em todos os ambientes.
- **Valores separados por espaço; uma expressão com espaços precisa de parênteses.** Escrever `1 + 2` solto é erro, com uma mensagem que explica isso. Motivo: um espaço esquecido viraria três valores silenciosamente.
- **Aritmética mista bigint/number.** Literais inteiros viram `bigint` (exatos, para `uint64` não perder bits); literais com ponto ou expoente viram `number`. A divisão `/` entre inteiros dá inteiro se for exata e real se não for; `//` é divisão inteira com piso; `%` segue o sinal do divisor; `**` associa à direita e `-2**2 = -4`. **A precedência segue o Python.**
- Numa seção inteira o valor final precisa ser inteiro (`(10/4)` em `uint8` é erro) e estar no intervalo do tipo.
- Funções: `sin cos tan asin acos atan atan2 sqrt cbrt exp log log2 log10 hypot rad deg abs min max floor ceil round trunc int float`. Constantes: `pi tau e inf nan`. Literais: `0x 0b 0o`, separador `_`, `'A'`.
- `$nome` é o offset de um rótulo; `$.` é o offset do próprio valor sendo escrito.

### 3.5 Rótulos e layout em ponto fixo

- Um rótulo pode ser usado antes de ser definido. Todas as referências são checadas antes da montagem (rótulo indefinido é erro, com a linha).
- **Os tamanhos podem depender de rótulos** (`<<fill 510-($.-$inicio)`, instruções de tamanho variável). O algoritmo começa com todos os rótulos em 0, recalcula tamanhos e rótulos e **repete até nada mudar** (máximo de 32 passadas). Durante as passadas, um `fill` negativo vale 0; no resultado final, é erro.
- O `--map` mostra a coluna "relativo" (distância até o último rótulo), útil para preencher os `byteOffset` do glTF.

### 3.6 `<<assembly(arq)`

- **O backend padrão é o LLVM** (`llvm-mc` para montar, `ld.lld` só quando há relocações). Motivo: um único conjunto de ferramentas cobre mais de 30 arquiteturas, incluindo AVR (Atmel), AArch64 (Apple Silicon), x86 16/32/64, ARM/Thumb/Cortex-M, RISC-V, MIPS, PPC.
- **"Todos os tipos de assembly" não é possível só com o LLVM** (faltam Z80, 6502, 8051, PIC). A solução são **backends por comando** configurados em `txt2bin.config.json`: qualquer montador que gere binário puro. Só o NASM foi testado; as configurações de `sjasmplus` (Z80) e `vasm` (6502) são exemplos não verificados.
- **`${expressão}`** coloca valores do arquivo dentro do código. Não se usa `$nome` porque o `$` já tem significado no AT&T (`$60`) e no MIPS (`$t0`).
- **`org` padrão = offset da seção no arquivo** (o arquivo é tratado como uma imagem carregada no endereço 0). `org=0x7c00` é o caso do setor de boot.
- **x86 usa sintaxe Intel por padrão**, com `syntax=att` como opção. Na sintaxe Intel, `;` é comentário (NASM/MASM), e o txt2bin converte para o `#` do LLVM. Motivo: no `llvm-mc`, `;` separa instruções e caracteres acentuados nos comentários davam erro.
- **Apelidos** para os nomes que o Higor usou: `intel_x86`→`x86`, `apple_silicon` (com `mcpu=apple-m1`), `atmel`/`arduino`→`avr` (padrão `atmega328p`). Hífens e maiúsculas são normalizados.

### 3.7 Saída e CLI

- Formatos: `bin`, `hex`, `base64`, `base64url`, `datauri`, `ihex`. O **Intel HEX** foi incluído por causa do AVR/Arduino, já que o `avrdude` espera esse formato.
- Erros sempre como `arquivo:linha: mensagem`, inclusive os do montador, com a linha traduzida para o arquivo-fonte.
- `--base64` foi mantido como apelido de `-f datauri`, para ser compatível com a v1.

### 3.8 Nomes e plataforma

- Pacote npm: `txt2bin` (o nome estava livre em 24/11; `binscript`, `bintext` e `binsrc` também estavam). **O nome final ainda é decisão do Higor.**
- Extensão de arquivo: **`.ttb`**, escolhida pelo Higor.
- **Identificadores em português** (`montar`, `separarSecoes`, `ErroFonte`, `rotulos`), seguindo o idioma do autor.
- O código roda direto no Bun (TS) e é empacotado para Node pelo `scripts/build.ts`. O `exports` tem a condição `bun` apontando para `src/`.

---

## 4. Arquitetura do código

```text
src/
  secoes.ts        separarSecoes(): quebra a fonte em seções (<< na coluna 0)
                   lerCabecalho(): nome, (param), "+", argumentos
  expr.ts          léxico + descida recursiva + aritmética bigint/number
                   separarTermos(): divide valores por espaço, respeitando parênteses,
                   'c' e comentários #; erros de parênteses saem com a linha certa
  codificar.ts     TIPOS (escritores por DataView), paraFloat16, decodificarTexto,
                   utf16, hex, base64/base64url
  montar.ts        interpretar() → Item[]; checagem de rótulos; dimensionar()
                   repetido até o ponto fixo; emissão final
  saida.ts         formatar() (bin/hex/base64/datauri/ihex), intelHex(), mapa()
  erros.ts         ErroFonte (linha + mensagem) e ehErroFonte()
  asm/
    arquiteturas.ts  ARQUITETURAS (triple, mcpu, mattr, prelúdio) e APELIDOS
    montador.ts      montar(): cache; LLVM (llvm-mc → ELF → [ld.lld] → .text);
                     backends por comando; acharFerramenta() (PATH, -NN, Homebrew,
                     LLVM_MC/LD_LLD)
    elf.ts           leitor mínimo de ELF 32/64, LE/BE: seções e símbolos
  cli.ts           argumentos, txt2bin.config.json ao lado da entrada, saída
  index.ts         API pública
scripts/build.ts   dist/ para Node (troca o shebang bun → node)
editores/vscode/   extensão (seção 6)
```

**Fluxo:** fonte → `separarSecoes` → `interpretar` (valida cabeçalhos e decodifica texto/hex/base64) → checagem de rótulos → laço `dimensionar` (avalia `align`/`fill`, monta o assembly com `${}` substituído e `org` calculado, registra rótulos) até estabilizar → emissão dos números com os rótulos finais.

**Pontos sutis do backend LLVM** (cada um veio de um bug real encontrado nos testes):

- **Rótulo de fim `__txt2bin_fim__`**, acrescentado ao código: dá o tamanho real do código. O MIPS completa a seção até o alinhamento, e sem isso sairiam bytes a mais.
- **Seções de metadados ignoradas** (`.reginfo`, `.MIPS.*`, `.note*`, `.*.attributes`). Qualquer outra seção alocável fora de `.text` é erro ("use só a seção padrão").
- **`org` desalinhado:** o `ld.lld` alinha `.text`. Quando `org % alinhamento ≠ 0`, o código é montado de novo com `.fill delta` na frente, ligado em `org - delta`, e os `delta` bytes iniciais são descartados.
- **Thumb:** o bit 0 do símbolo de fim é zerado.
- **Empacotamento:** o `bun build` chegou a duplicar módulos no bundle para Node, e o `instanceof ErroFonte` falhava. Por isso existe `ehErroFonte()`, que testa pela forma (`name === 'ErroFonte'` e `linha` numérica). **Use sempre `ehErroFonte`, nunca `instanceof`.**

---

## 5. Assembly: como funciona e o que foi testado

Montaram com sucesso, com um trecho curto cada (LLVM 18): `x86_16, x86, x86_64` (Intel e AT&T), `arm, thumb, cortex_m0, arm64, apple_silicon, avr, riscv32, riscv64, mips, mipsel, ppc, sparc, s390x, msp430, xtensa, loongarch64, hexagon, bpf`, além dos apelidos `intel_x86` e `atmel`. Também `mcpu=attiny85`, `mcpu=apple-m3`, `mcpu=cortex-m7` e `triple=lanai`.

Casos verificados com bytes conferidos:

- Setor de boot (`exemplos/boot-x86.ttb`): 512 bytes, `mov si, offset msg` → `be 15 7c` com `org=0x7c00`. Desmontado e conferido.
- Arduino blink (`exemplos/arduino-blink.ttb`): 20 bytes, desmontado à mão. Os saltos `brne` e `rjmp` apontam para os lugares certos.
- `add rax, ${$fim}` com o rótulo depois de um `fill 200`: o layout converge com a instrução de 6 bytes.
- O backend NASM (`txt2bin.config.json`) resolve `mov si, msg` com `org` correto.

**Não funciona ou é parcial:**

- `m68k`: o backend do LLVM é experimental; `moveq` não existe nele.
- macOS: ao que tudo indica, o `llvm-mc` não vem com as Command Line Tools do Xcode (não verificado); a recomendação é `brew install llvm lld`.
- Z80, 6502, 8051 e PIC só com backend por comando (não testado).

---

## 6. Extensão do VS Code

`editores/vscode/` — identificador da linguagem `txt2bin`, extensão `.ttb`.

- **Gramática** `syntaxes/txt2bin.tmLanguage.json` (TextMate). Cada `<<diretiva` abre um bloco que vai até `(?=^<<)`. O repositório interno tem `expressao`, `assembly`, `escapes`, `rotulo` e `valor_opcao`. O assembly é genérico: mnemônico no início da linha, rótulos `nome:`, diretivas `.xxx`, registradores comuns de várias arquiteturas, comentários `;`, `//`, `@` (após espaço) e `#` (seguido de espaço; `#5` do ARM é imediato), e `${...}` como expressão embutida. A gramática foi gerada por um script Python durante a conversa; hoje o JSON é a fonte, e não há gerador no repositório.
- **`src/extension.ts`** importa o próprio conversor (`../../../src/index.ts`) e o `build.ts` empacota tudo num `dist/extension.js` CommonJS (~50 KB). Funções:
  - diagnósticos (`ErroFonte` → sublinhado na linha);
  - hover (valor de `$rótulo`; offset/tamanho da seção; bytes do assembly até 64);
  - definição (F12 em `$rótulo`);
  - inlay hints (`0x… · N B` no fim de cada cabeçalho);
  - outline;
  - comandos `txt2bin.gerar`, `txt2bin.mapa`, `txt2bin.hex`;
  - snippets `glb`, `bloco`, `asm`, `boot`, `@`, `#`.
- **Configurações:** `txt2bin.validacao` (`aoDigitar` | `aoSalvar` | `desligada`), `txt2bin.atraso` (400 ms), `txt2bin.mostrarOffsets`.
- **Como é verificada:** `bun test` em `editores/vscode/` roda 25 testes. São 17 de gramática, com o motor de realce do VS Code (`vscode-textmate` + `vscode-oniguruma`), incluindo "nenhum exemplo tem trecho inválido", e 8 da lógica da extensão, com uma imitação da API `vscode` (`test/vscode-falso.ts` + `mock.module`). `bun run previa` gera uma prévia colorida em HTML. **A extensão nunca foi aberta num VS Code de verdade durante a conversa.**
- **Documentação didática completa:** `editores/vscode/SOBRE-A-EXTENSAO.md` (como funciona, regra por regra da gramática, testes, receitas, publicação).
- **Guia em Typst:** `docs/extensao-vscode/` (`main.typ` + um arquivo por capítulo em `capitulos/`). Conta a história desde o armário e explica a extensão usando o `midi.ttb` como exemplo do começo ao fim. Compile com `typst compile docs/extensao-vscode/main.typ docs/extensao-vscode.pdf` (Typst ≥ 0.15; nesta máquina, instalado com `cargo install --locked typst-cli`). **O PDF não é versionado** (`docs/*.pdf` está no `.gitignore`): só os fontes `.typ` entram no git. Os números citados (offsets, tokens, dump) saíram do conversor e do motor de realce; se mudarem, atualize o guia.
- **Pendências:** trocar `publisher` (`seu-publisher`) e `license` (`UNLICENSED`) no `package.json` antes de publicar no Marketplace.

---

## 7. Projetos parecidos (pesquisa)

**Não existe um padrão estabelecido** para "escrever binário em texto", mas há vários projetos independentes com ideias parecidas:

| projeto | o que é |
|---|---|
| **hext** (Rust, `.hxt`) | binário com comentários, alternando hex, binário e decimal, com strings; ordem de bytes por diretiva |
| **xx** (netspooky, Python) | formato de texto para criar binários a partir de dumps hex anotados |
| **BinMake** | binário a partir de texto legível; palavras-chave `big-endian`/`little-endian` |
| **t2b** | linguagem de macros: laços, variáveis, condicionais, recursão |
| binmark, Binify, hhh, HexSyn, hx | variações menores |
| **NASM `-f bin`** | o parente mais próximo: `db/dw/dd`, rótulos, `$`, `times`, `incbin` |
| **Sintaxe de bits do Erlang** | `<<1:16/big>>`; também usa `<<…>>` e especificadores de ordem |
| Kaitai Struct, ImHex, 010 Editor | descrevem formatos para **ler** binários (o caminho inverso) |

**O que diferencia o txt2bin:** junta texto, base64, números com ordem de bytes por seção, expressões com rótulos resolvidos por ponto fixo e **assembly de várias arquiteturas** no mesmo arquivo, com saída Intel HEX.

---

## 8. Limitações conhecidas e armadilhas

- **x86 Intel:** `mov si, msg` lê a memória; para o endereço, use `mov si, offset msg` (como no MASM).
- **MIPS:** o montador preenche os *delay slots* com `nop` (`.set reorder`). Use `.set noreorder` para controlar.
- **Assembly só na seção padrão:** `.data`, `.bss` e `.section` são recusados.
- **A validação ao digitar chama o `llvm-mc`** a cada pausa (há cache por conteúdo). Em arquivos grandes, prefira `aoSalvar`.
- **Uma seção numérica com uma expressão sem parênteses e com espaços** é erro proposital, não um bug.
- **Funções trigonométricas** usam `number` (double). Precisão de inteiros só com operações inteiras.
- A v1 em JavaScript (`txt2bin.js` do projeto de estudo de glTF) aceitava `<<` em qualquer posição. Arquivos antigos que dependam disso precisam de ajuste (nenhum dos exemplos dependia).

---

## 9. Pendências e ideias

Decisões que são do Higor:

- [ ] Nome definitivo do pacote no npm (`txt2bin` estava livre em 24/11/2026).
- [ ] Licença (o pacote e a extensão ainda não têm uma).
- [ ] `publisher` do VS Code Marketplace.
- [ ] README em inglês para o npm (a especificação está em português).

Ideias levantadas na conversa, ainda não implementadas:

- [ ] **`crc32()` e outros checksums sobre um intervalo de rótulos.** Necessário para PNG e ZIP. Exige cuidado no ponto fixo, porque o conteúdo depende de outros bytes.
- [ ] `<<include arquivo` (texto ou binário, como o `incbin` do NASM).
- [ ] Repetição/macros (algo como `times` do NASM).
- [ ] `utf32` / `utf32+`.
- [ ] Backends de assembly em WebAssembly (sem exigir LLVM instalado).
- [ ] Testar de verdade os backends Z80/6502 e a extensão dentro do VS Code.
- [ ] Reaproveitar a gramática TextMate no GitHub Linguist/Shiki.

---

## 10. Guia para agentes de IA

**Antes de mudar algo:**

1. Leia o `README.md` (especificação) e as seções 3 e 8 deste arquivo. Várias escolhas que parecem estranhas são intencionais (coluna 0, parênteses obrigatórios, `+` proibido em bytes, `ehErroFonte`).
2. Rode `bun test` e `bun run typecheck` antes e depois. Os testes de assembly exigem `llvm-mc` e `ld.lld` (`txt2bin --arquiteturas` mostra se foram encontrados).
3. **Os exemplos têm SHA-256 fixado em `test/exemplos.test.ts`.** Se uma mudança alterar um exemplo, confirme que a mudança é intencional antes de atualizar o hash. O `gltf-face.ttb` precisa continuar idêntico ao gerado pela v1.

**Convenções:**

- Português em identificadores, mensagens e documentação. Mensagens de erro dizem **o que** está errado e, quando possível, **como corrigir** (ex.: "use parênteses", "isso é base64url?").
- Todo erro ligado ao arquivo-fonte é `ErroFonte(linha, mensagem)`. Use `naLinha()` em `montar.ts` para envolver código que pode lançar.
- Não use `instanceof ErroFonte`; use `ehErroFonte()`.
- Uma nova diretiva precisa de: um caso em `interpretar()` (`montar.ts`), a regra de `+` (`PODE_BIG_ENDIAN`), uma linha na tabela do README, uma regra na gramática do VS Code e testes.
- Uma nova arquitetura vai em `src/asm/arquiteturas.ts` (e apelidos em `APELIDOS`), com um teste em `test/assembly.test.ts` que confira os bytes.
- A gramática do VS Code deve acompanhar a linguagem. Depois de mudá-la, confira a tokenização com `vscode-textmate` (já está em `devDependencies` da extensão).

**Para publicar:** `bun run prepublishOnly` (typecheck + testes + build) no pacote; `bun run package` em `editores/vscode/` gera o `.vsix`.
