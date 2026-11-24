# Roadmap do txt2bin

> Funcionalidades planejadas, com o desenho discutido até agora e as perguntas ainda em aberto.
> Nada aqui está implementado. Ao implementar um item, mova as decisões para o `CONTEXTO.md`
> (seção 3), a sintaxe para `docs/especificacao.md` e o resumo para o `CHANGELOG.md`, e marque o item.
>
> Registrado em 24/11/2026, depois da v0.4.0 (conversor) e da v0.2.1 (extensão do VS Code).

## Sumário

1. [Linguagem](#1-linguagem)
   1. [`<<import` e `<<place`](#11-import-e-place) (próximo a implementar)
   2. [Checksums: `crc32`, `adler32`, soma de 8 bits](#12-checksums-crc32-adler32-soma-de-8-bits)
   3. [Repetição](#13-repetição)
   4. [Itens menores](#14-itens-menores)
2. [Ferramentas](#2-ferramentas)
3. [Extensão do VS Code](#3-extensão-do-vs-code)
4. [Infraestrutura e divulgação](#4-infraestrutura-e-divulgação)

---

## 1. Linguagem

### 1.1 `<<import` e `<<place`

**Prioridade: é o próximo item, por escolha do Higor.**

**A ideia (proposta do Higor).** Separar *declarar* um bloco reutilizável de *colocar* os bytes dele no arquivo:

```text
<<import @logo imagens/logo.ttb     # declara; não gera bytes
...
<<place @logo                       # aqui entram os bytes do logo.ttb
...
<<place @logo                       # pode repetir em vários lugares
```

- O `<<import` fica em qualquer lugar do documento, coerente com os rótulos, que já podem ser usados antes de definidos.
- O `<<place` pode aparecer quantas vezes quiser.
- O `<<import` sozinho não gera bytes; só o `<<place` gera.

**Perguntas em aberto** (precisam de decisão antes de implementar):

1. **Rótulos dentro do arquivo importado.** É a questão central. Se o `logo.ttb` define `<<@fim` e é colocado duas vezes, há dois `$fim`. Caminho sugerido: cada `<<place` cria um escopo próprio. Dentro dele, `$fim` é o fim *daquela cópia*; de fora, o acesso é qualificado. Com duas cópias, `$logo.fim` fica ambíguo, então talvez o `place` precise de um nome por cópia:
   ```text
   <<place @logo as capa
   <<place @logo as rodape
   <<uint32
   $capa.fim - $capa.inicio
   ```
2. **O `@` no nome do import.** Hoje `<<@nome` define um rótulo. `<<place @logo` fica a uma palavra de distância de `<<@logo`, com significado bem diferente. Opções:
   - nome sem sigilo (`<<import logo arquivo.ttb`, `<<place logo`);
   - um sigilo próprio para importações;
   - assumir de propósito que um import também é um rótulo, e definir o que `$logo` significa nesse caso.
3. **O arquivo importado enxerga o de fora?** Pode usar `$.` (a posição onde foi colocado) ou rótulos do arquivo principal?
   - **Isolado:** mais simples e previsível; o `logo.ttb` continua funcionando sozinho.
   - **Aberto:** mais poderoso, mas cria dependência do contexto.
   - Uma via intermediária são **parâmetros explícitos** (`<<place @onda freq=440`). Isso se aproxima da repetição (1.3) e pode ser a ponte entre as duas.
4. **Regras de borda:**
   - o caminho é relativo ao arquivo que importa, e não à pasta onde o comando roda;
   - importação em ciclo (`a` importa `b`, que importa `a`) é erro, com a cadeia na mensagem;
   - um `<<import` sem nenhum `<<place` gera um aviso?
   - um `<<place` de um nome nunca importado é erro.
5. **Arquivos binários.** Embutir uma imagem ou um `.bin` pronto (como o `incbin` do NASM) é uma necessidade vizinha. Proposta: o mesmo `<<import` serve para os dois casos. Um `.ttb` é compilado; qualquer outra extensão entra como bytes crus. Isso substitui a ideia antiga de um `<<include` separado.

**Impacto no código** (levantado de antemão):

- **Erros:** hoje `ErroFonte` só tem `linha`, porque só existe um arquivo. Precisa ganhar o **arquivo**, e talvez a cadeia de inclusão ("em `logo.ttb:3`, colocado em `main.ttb:20`"). Isso afeta o CLI (`arquivo:linha`), a extensão (o diagnóstico pode estar em outro arquivo) e a API.
- **Layout:** cada cópia colocada vira um conjunto de itens com offsets próprios. O ponto fixo já lida com tamanhos que dependem de rótulos; os escopos precisam entrar no mapa de rótulos.
- **API:** `montar(fonte)` recebe texto, sem caminho. Para importar, precisa de um caminho base ou de uma função que leia arquivos. Isso também viabiliza o playground no navegador, com arquivos virtuais.
- **`--map`:** mostrar de qual arquivo veio cada seção.
- **Extensão do VS Code:** gramática para `import`/`place`; F12 no `<<place` abrindo o arquivo importado; analisar de novo o arquivo principal quando um importado mudar.

### 1.2 Checksums: `crc32`, `adler32`, soma de 8 bits

**Por quê.** Vários formatos guardam um checksum dos próprios dados, e quem lê o arquivo recalcula e compara. Se não bater, o arquivo é tratado como corrompido. Hoje o checksum teria de ser calculado fora e colado à mão, e qualquer mudança nos dados exigiria refazer. É o mesmo problema que os rótulos resolveram para tamanhos e offsets.

| formato | o que precisa |
|---|---|
| PNG | CRC32 de cada bloco (tipo + dados); os pixels vêm num invólucro zlib, que exige **adler32** |
| ZIP | CRC32 do conteúdo de cada arquivo |
| gzip | CRC32 dos dados originais |
| ROMs (Game Boy e outras) | soma simples de 8 bits do cabeçalho |

**Desenho proposto:** funções nas expressões sobre um intervalo entre rótulos.

```text
<<@ini_crc
<<utf8
IHDR
...
<<@fim_dados
<<uint32+
crc32($ini_crc, $fim_dados)
```

**Cuidados:**

- O checksum depende dos bytes, e alguns bytes dependem de rótulos. Ele precisa ser calculado **depois** que o layout se estabiliza, na emissão.
- O tamanho de um checksum é fixo (o tipo da seção), então ele não afeta o layout.
- Um checksum não pode cobrir a si mesmo nem outro valor que dependa dele. Isso tem de ser detectado e virar erro.
- Ordem de cálculo quando um checksum cobre outro (o CRC de um bloco ZIP que contém um CRC interno): calcular de dentro para fora.

**Exemplo que fecharia o item:** `exemplos/png-minimo.ttb`, uma imagem pequena válida, com os pixels num bloco zlib "stored" (sem compressão), que só exige o adler32.

### 1.3 Repetição

**Ainda em aberto. O Higor pensa em algo parecido com o Typst** (`#for i in range(12) [ ... ]`).

**Por quê.** Hoje não dá para gerar, por exemplo, um WAV com um tom de um segundo sem escrever milhares de amostras à mão, nem uma tabela de 256 entradas sem listá-las.

**A tensão de desenho:** uma seção termina na próxima diretiva, e não existe "fim de bloco". Uma repetição precisa delimitar o que se repete, e isso é a maior mudança de sintaxe até agora. Caminhos a avaliar:

- **Bloco com fim explícito** (`<<for i in 0..256` … `<<end`): introduz o conceito de bloco na linguagem.
- **Repetição de uma seção só**, sem bloco: `<<uint8 for i in 0..256` com o corpo usando `i`. Cobre as tabelas, mas não estruturas com várias seções.
- **Via `<<place` com parâmetros** (1.1): a repetição coloca um `.ttb` várias vezes com valores diferentes. Reaproveita os escopos do import.

**Decisão sugerida:** desenhar depois do import, aproveitando os escopos e os parâmetros que ele trouxer.

### 1.4 Itens menores

- [ ] `<<utf32` / `<<utf32+`.
- [ ] **Coluna nos erros:** hoje o erro só diz a linha, e o sublinhado no editor ocupa a linha inteira.
- [ ] **Vários erros por análise:** hoje o conversor para no primeiro.
- [ ] Números reais em `<<decimal` (exigiria definir regras de precisão; útil para coordenadas no conteúdo de páginas PDF).

## 2. Ferramentas

- [ ] **Backends de assembly em WebAssembly**, para não exigir LLVM instalado (e para o assembly funcionar no playground).
- [ ] **Testar de verdade os backends Z80 e 6502** do `exemplos/txt2bin.config.json`. Só o NASM foi testado.
- [ ] **Rodar os testes de assembly no macOS.** Nesta máquina o Homebrew não instala nada sem `sudo` (ver memória/CONTEXTO), então os 14 testes de assembly são pulados.

## 3. Extensão do VS Code

- [ ] **`publisher` do Marketplace** (decisão do Higor; hoje é `seu-publisher`) e publicação no Marketplace e no Open VSX. Roteiro: `docs/publicar-extensao.typ`.
- [ ] Autocompletar `$rótulos`, nomes de diretivas e de arquiteturas.
- [ ] Hover sobre bytes `hex` mostrando o offset de cada byte.
- [ ] `<<utf8 json` (ou outra anotação) para colorir JSON embutido.
- [ ] *Source maps* no build, para pontos de parada no `extension.ts`.
- [ ] Gerar o `.vsix` e publicar via CI.
- [ ] Reaproveitar a gramática no GitHub (Linguist) e no Shiki, para os `.ttb` ficarem coloridos no GitHub e em sites de documentação.

## 4. Infraestrutura e divulgação

- [ ] **CI no GitHub Actions:** typecheck e testes a cada push, **com LLVM**, para rodar os 14 testes de assembly; selo de "testes passando" no README; testes com o sistema em inglês e em português.
- [ ] **Executáveis por sistema** (`bun build --compile`) nos Releases do GitHub, para quem não quer instalar Node nem Bun.
- [ ] **Repositório no GitHub:** descrição, tópicos (`binary`, `file-format`, `hex`, `assembler`, `pdf`, `midi`), imagem de prévia social e um GIF da extensão mostrando os offsets mudando enquanto se digita.
- [ ] **Playground no navegador (GitHub Pages):** digitar `.ttb` e baixar o arquivo, sem instalar nada. Depende de a API aceitar arquivos virtuais (ver 1.1, impacto na API) e, para assembly, do item de WebAssembly.
- [ ] **Divulgação:** Show HN, Lobsters, Reddit (r/programming, r/osdev, r/embedded, r/arduino, r/ReverseEngineering), TabNews, e um post contando a história "do armário ao PDF". Melhor depois do playground e do PNG.
