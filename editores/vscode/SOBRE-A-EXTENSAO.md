# Sobre a extensão do VS Code

> Como a extensão do txt2bin funciona, arquivo por arquivo e linha por linha, para quem
> nunca fez uma extensão de editor. Ao terminar a leitura você deve conseguir: explicar
> por que cada pedaço de um `.ttb` recebe a cor que recebe, seguir o caminho de um erro
> até o sublinhado vermelho, mudar a gramática sem quebrar nada, testar sem abrir o
> VS Code e publicar a extensão.
>
> Pasta: `editores/vscode/`. Versão descrita: `0.2.1` (24/11/2026).

---

## Sumário

1. [A ideia geral](#1-a-ideia-geral)
2. [Mapa dos arquivos](#2-mapa-dos-arquivos)
3. [O manifesto: `package.json`](#3-o-manifesto-packagejson)
4. [Comportamento de editor: `language-configuration.json`](#4-comportamento-de-editor-language-configurationjson)
5. [Cores: a gramática TextMate](#5-cores-a-gramática-textmate)
6. [A gramática do txt2bin, regra por regra](#6-a-gramática-do-txt2bin-regra-por-regra)
7. [A parte que roda: `src/extension.ts`](#7-a-parte-que-roda-srcextensionts)
8. [Snippets](#8-snippets)
9. [Build e empacotamento](#9-build-e-empacotamento)
10. [Testes sem abrir o VS Code](#10-testes-sem-abrir-o-vs-code)
11. [Desenvolvendo no VS Code de verdade](#11-desenvolvendo-no-vs-code-de-verdade)
12. [Receitas: como mudar coisas](#12-receitas-como-mudar-coisas)
13. [Publicação](#13-publicação)
14. [Limitações, dívidas e história](#14-limitações-dívidas-e-história)
15. [Glossário](#15-glossário)

---

## 1. A ideia geral

Uma extensão de linguagem tem **duas metades** que funcionam de jeitos completamente diferentes.

**A metade declarativa** é feita só de arquivos JSON. O VS Code lê esses arquivos e faz o trabalho sozinho, **sem executar nenhum código nosso**:

- a **gramática** diz como dividir o texto em pedaços e que *nome* cada pedaço tem (é daí que vêm as cores);
- a **configuração de linguagem** diz qual é o caractere de comentário, quais pares de parênteses fechar sozinho, o que é uma "palavra" para o duplo clique;
- os **snippets** são modelos de texto que o autocompletar oferece.

**A metade programática** é um programa em TypeScript (`src/extension.ts`) que o VS Code executa num processo separado, o *Extension Host*, com Node. Ela faz o que exige **entender** o arquivo: converter, achar erros, calcular offsets, saber quanto vale um rótulo.

```text
                     ┌──────────────────────────── VS Code ────────────────────────────┐
  arquivo.ttb ──────►│  gramática (JSON)  ──► escopos ──► tema ──► CORES               │
                     │  language-configuration (JSON) ──► comentar, parênteses, dobrar  │
                     │  snippets (JSON) ──► autocompletar                               │
                     │                                                                  │
                     │  Extension Host (Node) ── extension.ts ── montar() do txt2bin    │
                     │       ├─► erros sublinhados (diagnósticos)                       │
                     │       ├─► offset/tamanho no fim da linha (inlay hints)           │
                     │       ├─► passar o mouse (hover), F12 (definição), Outline       │
                     │       └─► comandos: gerar binário, mapa, dump hex                │
                     └──────────────────────────────────────────────────────────────────┘
```

Essa divisão explica uma coisa que confunde no começo: **as cores e os erros são independentes**. A gramática não sabe que `$nada` é um rótulo inexistente; ela só vê o formato `$nome` e pinta de "rótulo". Quem descobre que o rótulo não existe é o conversor, rodando em `extension.ts`, que então sublinha a linha. Uma coisa pode funcionar com a outra quebrada.

---

## 2. Mapa dos arquivos

```text
editores/vscode/
├── package.json                    manifesto: o que a extensão oferece ao VS Code (seção 3)
├── language-configuration.json     comentários, parênteses, palavras, dobras (seção 4)
├── syntaxes/
│   └── txt2bin.tmLanguage.json     gramática TextMate: as cores (seções 5 e 6)
├── snippets/
│   └── txt2bin.json                modelos do autocompletar (seção 8)
├── src/
│   └── extension.ts                a parte que roda (seção 7)
├── build.ts                        empacota extension.ts + conversor num arquivo só (seção 9)
├── tsconfig.json                   checagem de tipos
├── .vscodeignore                   o que NÃO entra no .vsix
├── .vscode/
│   ├── launch.json                 F5: abre um VS Code de teste com a extensão (seção 11)
│   └── tasks.json                  tarefa de build que o F5 roda antes
├── test/
│   ├── gramatica.ts                carrega a gramática com o motor do VS Code (seção 10.1)
│   ├── gramatica.test.ts           17 testes de cores
│   ├── vscode-falso.ts             imitação da API do VS Code (seção 10.2)
│   └── extensao.test.ts            8 testes da parte que roda
├── scripts/
│   └── previa.ts                   gera previa.html com os exemplos coloridos (seção 10.3)
├── README.md                       página da extensão no Marketplace
├── SOBRE-A-EXTENSAO.md             este documento
├── dist/extension.js               (gerado) o que o VS Code executa
└── txt2bin-vscode-0.2.1.vsix       (gerado) o pacote instalável
```

Comandos (dentro de `editores/vscode/`):

| comando | o que faz |
|---|---|
| `bun install` | instala as dependências de desenvolvimento |
| `bun test` | roda os 25 testes (gramática + extensão) |
| `bun run typecheck` | checa os tipos com o `tsc` |
| `bun run build` | gera `dist/extension.js` |
| `bun run previa` | gera `previa.html` |
| `bun run package` | typecheck + testes + build + gera o `.vsix` |

---

## 3. O manifesto: `package.json`

É um `package.json` comum de npm com campos a mais que só o VS Code entende. Cada campo:

```jsonc
{
  "name": "txt2bin-vscode",           // identificador técnico (publisher.name forma o ID único)
  "displayName": "txt2bin",           // nome exibido na lista de extensões
  "description": "...",
  "version": "0.2.1",
  "publisher": "seu-publisher",       // PRECISA ser trocado antes de publicar (seção 13)
  "license": "MIT",
  "engines": { "vscode": "^1.85.0" }, // versão mínima do VS Code; casa com @types/vscode@1.85
  "categories": ["Programming Languages", "Linters"],
  "main": "./dist/extension.js",      // o arquivo que o Extension Host executa
  "activationEvents": [],             // vazio de propósito (ver abaixo)
  "contributes": { ... }              // tudo o que a extensão acrescenta ao editor
}
```

**`activationEvents` vazio.** Uma extensão não roda desde que o VS Code abre: ela é *ativada* quando acontece um evento. Desde o VS Code 1.74, contribuir uma linguagem já cria o evento implícito `onLanguage:txt2bin`, e contribuir um comando já cria `onCommand:...`. Então a extensão é ativada sozinha quando você abre um `.ttb` ou chama um dos comandos. Por isso a lista fica vazia.

### `contributes`

```jsonc
"languages": [{
  "id": "txt2bin",                    // o nome interno da linguagem (usado em todo lugar)
  "aliases": ["txt2bin", "TTB"],      // nomes exibidos (o primeiro aparece na barra de status)
  "extensions": [".ttb"],             // arquivos com essa extensão viram txt2bin
  "configuration": "./language-configuration.json"
}],
```

Esse bloco diz: "existe uma linguagem `txt2bin`, e arquivos `.ttb` são dela". Sem ele, nada mais se aplica.

```jsonc
"grammars": [{
  "language": "txt2bin",              // a qual linguagem a gramática pertence
  "scopeName": "source.txt2bin",      // nome raiz da gramática; aparece em todo token
  "path": "./syntaxes/txt2bin.tmLanguage.json"
}],
"snippets": [{ "language": "txt2bin", "path": "./snippets/txt2bin.json" }],
```

```jsonc
"commands": [
  { "command": "txt2bin.gerar", "title": "Gerar arquivo binário", "category": "txt2bin" },
  { "command": "txt2bin.mapa",  "title": "Mostrar mapa de seções", "category": "txt2bin" },
  { "command": "txt2bin.hex",   "title": "Mostrar dump hexadecimal", "category": "txt2bin" }
],
```

Declarar um comando aqui faz ele aparecer na paleta (Ctrl+Shift+P) como "txt2bin: Gerar arquivo binário". **Declarar não basta para funcionar**: o código precisa registrar o mesmo identificador com `vscode.commands.registerCommand` (seção 7.8). Se faltar o registro, o comando aparece mas dá erro ao ser chamado.

```jsonc
"menus": {
  "editor/title": [{
    "command": "txt2bin.gerar",
    "when": "editorLangId == txt2bin",  // só aparece em arquivos .ttb
    "group": "navigation"               // "navigation" = ícone visível na barra, não no menu "…"
  }]
},
```

```jsonc
"configuration": {
  "title": "txt2bin",
  "properties": {
    "txt2bin.validacao":      { "type": "string", "enum": ["aoDigitar", "aoSalvar", "desligada"], "default": "aoDigitar" },
    "txt2bin.atraso":         { "type": "number", "default": 400 },
    "txt2bin.mostrarOffsets": { "type": "boolean", "default": true }
  }
}
```

Isso cria uma página nas Configurações do VS Code. O código lê os valores com `vscode.workspace.getConfiguration('txt2bin').get('validacao')`.

### `scripts` e `devDependencies`

| script | |
|---|---|
| `build` | `bun run build.ts` |
| `typecheck` | `tsc --noEmit` |
| `test` | `bun test` |
| `previa` | `bun run scripts/previa.ts` |
| `package` | `typecheck && test && build && vsce package --no-dependencies --skip-license --allow-missing-repository` |

| dependência (só de desenvolvimento) | para quê |
|---|---|
| `@types/vscode@1.85.0` | tipos da API do VS Code (versão igual à de `engines`) |
| `@types/node`, `bun-types`, `typescript` | tipos e checagem |
| `@vscode/vsce` | gera o `.vsix` e publica |
| `vscode-textmate`, `vscode-oniguruma` | o motor de realce do VS Code, usado nos testes |

A extensão **não tem dependências de execução**: tudo o que ela usa (inclusive o conversor) é embutido no `dist/extension.js` pelo build. Por isso o `vsce` roda com `--no-dependencies`.

---

## 4. Comportamento de editor: `language-configuration.json`

```json
{
  "comments": { "lineComment": "#" },
  "brackets": [["(", ")"], ["${", "}"]],
  "autoClosingPairs": [
    { "open": "(", "close": ")" },
    { "open": "${", "close": "}" },
    { "open": "\"", "close": "\"", "notIn": ["string"] }
  ],
  "surroundingPairs": [["(", ")"], ["\"", "\""]],
  "wordPattern": "(\\$[A-Za-z_][\\w.]*)|(-?\\d*\\.\\d\\w*)|([^...\\s]+)",
  "folding": { "markers": { "start": "^<<", "end": "(?=^<<)" } }
}
```

| campo | efeito |
|---|---|
| `comments.lineComment` | o Ctrl+/ (alternar comentário de linha) põe `#` no começo da linha. É o comentário das seções hex e numéricas. Em `utf8` o `#` é texto, e no assembly depende da arquitetura; ali o atalho não ajuda. |
| `brackets` | pares que o editor destaca juntos e usa para colorir parênteses aninhados. `${` … `}` é o par do assembly. |
| `autoClosingPairs` | ao digitar `(` o editor escreve `)`; ao digitar `${`, escreve `}`. `notIn: ["string"]` evita fechar aspas dentro de texto. |
| `surroundingPairs` | com um trecho selecionado, digitar `(` envolve o trecho em parênteses. |
| `wordPattern` | o que conta como "uma palavra" para duplo clique, Ctrl+D e destaque de ocorrências. A primeira alternativa, `\$[A-Za-z_][\w.]*`, faz `$fim` ser uma palavra só, com o `$`. Sem ela, o duplo clique em `$fim` selecionaria só `fim`. |
| `folding.markers` | onde blocos podem ser recolhidos: cada `<<diretiva` abre um bloco que vai até a próxima. O triângulo de dobrar aparece ao lado de cada cabeçalho. |

---

## 5. Cores: a gramática TextMate

### 5.1 O formato

O VS Code colore código com **gramáticas TextMate**, um formato criado para o editor TextMate (macOS, 2004) e adotado por VS Code, Sublime Text, Atom, GitHub (Linguist) e Shiki. Uma gramática é uma lista de **regras com expressões regulares**. O motor de expressões regulares é o **Oniguruma**, o mesmo do Ruby, que aceita *lookahead* `(?=…)`, *lookbehind* `(?<=…)` de tamanho fixo e grupos de captura.

O motor trabalha **linha por linha**. Para cada linha, procura, entre as regras ativas no momento, a que casa mais cedo na linha; marca o trecho casado com um nome; e continua do ponto onde parou. O que liga uma linha à próxima é o **estado** (`ruleStack`): uma pilha que diz "estou dentro da regra X, que está dentro da Y". É graças a ela que a linha 15 de um bloco `<<assembly` sabe que está dentro de um assembly, mesmo sem nenhum `<<` nela.

### 5.2 Os três tipos de regra

**1. `match`: um trecho de uma linha.**

```json
{ "name": "constant.numeric.hex.txt2bin", "match": "\\b0[xX][0-9A-Fa-f_]+\\b" }
```

Tudo o que casar com a expressão (aqui, `0x1F`) recebe o nome `constant.numeric.hex.txt2bin`.

As barras são dobradas porque isto é JSON: `"\\b"` no arquivo é `\b` na expressão. Esse é o principal motivo de a gramática ser difícil de ler.

**2. `begin`/`end`: um bloco que pode ter várias linhas.**

```json
{
  "begin": "^(<<)(hex)()\\s*$",
  "end": "(?=^<<)",
  "patterns": [ ...regras que valem dentro do bloco... ]
}
```

Quando `begin` casa, o motor entra no bloco e empilha a regra. A partir daí, só valem as regras de `patterns`, mais o `end`. Quando `end` casa, o bloco termina e a regra sai da pilha.

**3. `include`: reaproveitar regras.**

```json
{ "include": "#expressao" }
```

Copia, naquele ponto, as regras guardadas em `repository.expressao`. O `repository` é um dicionário de grupos de regras com nome, para não repetir.

### 5.3 Capturas e `contentName`

Grupos `( )` da expressão podem receber nomes próprios:

```json
{
  "match": "^(<<)(@)([A-Za-z_][\\w.]*)\\s*$",
  "captures": {
    "1": { "name": "punctuation.definition.directive.txt2bin" },
    "2": { "name": "keyword.control.directive.label.txt2bin" },
    "3": { "name": "entity.name.label.txt2bin" }
  }
}
```

Em `<<@fim`, o `<<` (grupo 1), o `@` (grupo 2) e `fim` (grupo 3) ganham nomes diferentes e, portanto, podem ter cores diferentes. Em regras `begin`/`end`, o equivalente é `beginCaptures`/`endCaptures`.

Uma captura pode ter `patterns` em vez de `name`: o trecho capturado é tokenizado de novo com essas regras. É assim que o resto da linha `<<fill 510-($.-$inicio)` vira uma expressão colorida (regra 7, seção 6).

`contentName` dá um nome a **tudo o que fica entre** `begin` e `end`. Em `<<utf8`, o `contentName` é `string.unquoted.text.txt2bin`: todo o texto da seção fica com cor de string, e as regras internas (escapes) pintam só os pedaços especiais por cima.

### 5.4 Escopos e temas: de nome a cor

O nome dado a um trecho se chama **escopo**. Um token não tem um escopo só, mas uma **pilha** deles, do mais externo ao mais interno. Por exemplo, o `fim` dentro de `${$fim - 1}` num assembly tem:

```text
source.txt2bin
meta.embedded.block.assembly.txt2bin
meta.embedded.expression.txt2bin
variable.other.label.txt2bin
```

**A gramática não escolhe cores.** Quem escolhe é o **tema** (Dark+, Monokai, o que o usuário usar). O tema tem regras como "`comment` → verde" e "`constant.numeric` → verde-claro"; uma regra vale para o escopo com aquele prefixo (`constant.numeric` pega `constant.numeric.hex.txt2bin`). Entre várias regras que casam, vence a mais específica.

Por isso **os nomes seguem convenções**: um tema não conhece o txt2bin, mas sabe colorir `comment`, `string`, `constant.numeric`, `keyword`, `entity.name`, `variable`, `invalid`. Usando esses prefixos, o txt2bin fica bonito em qualquer tema. O sufixo `.txt2bin` existe para que alguém possa, se quiser, criar uma cor só para o txt2bin.

Escopos usados e a cor aproximada no Dark+:

| escopo (sem o `.txt2bin`) | onde aparece | Dark+ |
|---|---|---|
| `punctuation.definition.directive` | o `<<` | roxo |
| `keyword.control.directive` | `utf8`, `hex`, `uint32`, `assembly`… | roxo |
| `keyword.control.directive.label` | o `@` de `<<@nome` | roxo |
| `keyword.operator.endianness` | o `+` de big-endian | sem cor própria no Dark+ (cinza claro); laranja na prévia |
| `entity.name.label` | `nome` em `<<@nome`; rótulos `nome:` no assembly | amarelo |
| `comment.block.section` | seções `<<#` inteiras | verde |
| `comment.line.*` | `#…`, `;…`, `//…`, `@ …` | verde |
| `string.unquoted.text` | texto de `utf8`/`utf16` | salmão |
| `constant.character.escape` | `\n`, `\u{e9}` | dourado |
| `constant.numeric.*` | números, bytes hex | verde-claro |
| `constant.character` | `'A'` | salmão |
| `constant.language` | `pi`, `tau`, `e`, `inf`, `nan` | azul |
| `support.function.math` | `sin`, `round`… | amarelo |
| `variable.other.label` | `$fim`, `$.` | azul-claro |
| `keyword.operator.*` | `+ - * / ** // << >> & \| ^ ~` | cinza claro |
| `string.other.base64` | dados base64 | salmão |
| `entity.name.type.architecture` | `x86_64` em `<<assembly(x86_64)` | verde-água |
| `variable.parameter.option` | `org`, `mcpu` | azul-claro |
| `string.unquoted.option` | `atmega328p` | salmão |
| `keyword.other.mnemonic.asm` | `mov`, `sbi`, `rjmp` | azul |
| `variable.language.register.asm` | `rax`, `r18`, `x0`, `%d0`, `$t0` | azul vivo |
| `keyword.control.directive.asm` | `.byte`, `.set` | roxo |
| `storage.type.asm` | `offset`, `ptr`, `dword` | azul |
| `punctuation.section.embedded.*` | `${` e `}` | azul |
| `invalid.illegal.*` | erros de forma | vermelho |

Para ver o escopo de qualquer trecho dentro do VS Code: paleta → **"Developer: Inspect Editor Tokens and Scopes"**, e clique no trecho. É a ferramenta mais útil para mexer em gramáticas.

---

## 6. A gramática do txt2bin, regra por regra

Arquivo: `syntaxes/txt2bin.tmLanguage.json`. Cabeçalho:

```json
{
  "$schema": "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
  "name": "txt2bin",
  "scopeName": "source.txt2bin",
  "patterns": [ ...11 regras... ],
  "repository": { ...6 grupos... }
}
```

O `$schema` faz o VS Code validar e autocompletar o arquivo enquanto você edita.

### 6.1 O truque central: `"end": "(?=^<<)"`

Todo bloco de seção termina com o mesmo `end`:

```text
(?=^<<)
```

Lendo: "termina **logo antes** de uma linha que comece com `<<`". O `(?= )` é um *lookahead*: confere sem consumir. Assim, o `<<` da próxima seção **não é engolido** pelo fim da anterior, e pode ser casado pela regra da próxima seção. O `^` exige a coluna 0, a mesma regra do conversor (o `<<` no meio da linha não fecha nada).

Consequência: cada seção é um bloco, e o conteúdo dele só é colorido pelas regras daquela seção. Um `#` é comentário dentro de `<<hex`, texto dentro de `<<utf8` e depende do contexto dentro de `<<assembly`.

### 6.2 As 11 regras de nível superior (a ordem importa)

Quando duas regras casam na mesma posição, **vence a que vem primeiro na lista**. Por isso a regra genérica de "diretiva desconhecida" (9) fica depois das específicas.

**Regra 0: seção de comentário `<<#`**

```json
{ "name": "comment.block.section.txt2bin",
  "begin": "^(<<)(#)(.*)$", "end": "(?=^<<)",
  "beginCaptures": { "1": {"name": "punctuation.definition.comment..."}, "2": {...} } }
```

O `name` (não `contentName`) vale para o bloco inteiro, cabeçalho incluso: tudo fica verde até a próxima diretiva.

**Regra 1: rótulo `<<@nome`**

```json
{ "match": "^(<<)(@)([A-Za-z_][\\w.]*)\\s*$", "captures": { ...1, 2, 3... } }
```

É `match`, não `begin`/`end`: um rótulo não tem conteúdo. Se houver texto na linha seguinte, ele cai na regra 10 (vermelho), o que é coerente com o conversor, que recusa conteúdo em rótulo.

**Regras 2 e 3: texto `<<utf8`, `<<utf16`, `<<utf16+`**

```json
{ "begin": "^(<<)(utf16)(\\+)?\\s*$", "end": "(?=^<<)",
  "contentName": "string.unquoted.text.txt2bin",
  "patterns": [{ "include": "#escapes" }] }
```

`(\\+)?` aceita o `+` opcional e o pinta como `keyword.operator.endianness`. O `utf8` não aceita `+` (o conversor também não): `<<utf8+` não casa aqui e cai na regra 9, ficando vermelho.

**Regra 4: `<<hex`**

```json
"patterns": [
  { "include": "#comentario" },
  { "name": "constant.numeric.hex.byte.txt2bin", "match": "[0-9A-Fa-f]{2}" },
  { "name": "invalid.illegal.hex.txt2bin", "match": "[^\\s#]" }
]
```

A ordem dentro de `patterns` também importa. Primeiro comentários, depois **pares** de dígitos hex (cada byte é um token), e por fim qualquer outro caractere visível vira vermelho. Um dígito sobrando sozinho no fim (`0a b`) também fica vermelho, porque não forma par.

**Regra 5: `<<base64` e `<<base64url`**

Comentários; sequências do alfabeto (`[A-Za-z0-9+/_\-]+`, a união dos dois alfabetos); o `=` de preenchimento com escopo próprio; o resto em vermelho. A gramática **não distingue** os dois alfabetos: um `-` dentro de `<<base64` não fica vermelho. Quem acusa isso é o conversor, pelo diagnóstico (seção 7.3), com a dica "isso é base64url?".

**Regra 6: seções numéricas**

```json
{ "begin": "^(<<)(?:(u?int(?:8|16|32|64)|float(?:16|32|64))(\\+)?|(decimal|octal)(?:\\s+(\\d+))?)\\s*$",
  "end": "(?=^<<)", "patterns": [{ "include": "#expressao" }] }
```

Uma regra só para os 11 tipos binários e para `decimal`/`octal`. O `(?: )` agrupa sem capturar. As duas alternativas impedem combinações inválidas: o `+` só existe nos tipos binários (grupo 3), e a largura (grupo 5, pintada como número) só em `decimal`/`octal`. `<<decimal+` e `<<uint8 5` não casam e caem na regra 9, em vermelho.

**Regra 7: `<<align` e `<<fill`**

```json
{ "begin": "^(<<)(align|fill)\\b(.*)$",
  "beginCaptures": { ..., "3": { "patterns": [{ "include": "#expressao" }] } },
  "end": "(?=^<<)",
  "patterns": [{ "name": "invalid.illegal.content.txt2bin", "match": "\\S+" }] }
```

Aqui a expressão está **no cabeçalho**, e por isso a captura 3 tem `patterns`. O corpo deveria estar vazio: qualquer coisa nele fica vermelha.

**Regra 8: `<<assembly(arq) opções`**

```json
{ "begin": "^(<<)(assembly)(\\()([^)]*)(\\))(.*)$",
  "beginCaptures": {
    "4": { "name": "entity.name.type.architecture.txt2bin" },
    "6": { "patterns": [{
      "match": "\\b([A-Za-z_]\\w*)(=)(\\S+)",
      "captures": { "1": {"name": "variable.parameter.option..."}, "2": {...},
                    "3": { "patterns": [{ "include": "#valor_opcao" }] } } }] } },
  "end": "(?=^<<)",
  "contentName": "meta.embedded.block.assembly.txt2bin",
  "patterns": [{ "include": "#assembly" }] }
```

Três níveis de captura: a linha inteira → cada `chave=valor` do grupo 6 → o valor, tokenizado como expressão (`org=0x7c00`) ou texto (`mcpu=atmega328p`). O `contentName` com `meta.embedded` avisa ao VS Code que o corpo é "outra linguagem embutida". Nenhum tema pinta `meta.*`, mas alguns recursos do editor usam essa marcação.

**Regra 9: diretiva desconhecida**

```json
{ "match": "^(<<)(\\S*)(.*)$", "captures": { "2": { "name": "invalid.illegal.directive.txt2bin" } } }
```

Pega `<<foo`, `<<utf8+`, `<<hex extra`: qualquer `<<` que nenhuma regra anterior aceitou.

**Regra 10: texto fora de seção**

```json
{ "name": "invalid.illegal.before-directive.txt2bin", "match": "\\S.*" }
```

Só é alcançada fora de qualquer bloco: antes da primeira diretiva, ou depois de um `<<@rótulo`. Em ambos os casos o conversor dá erro, então fica vermelho.

### 6.3 Os grupos do `repository`

**`comentario`**

```json
{ "name": "comment.line.number-sign.txt2bin", "match": "#.*$" }
```

**`rotulo`**

```json
{ "match": "(\\$)(\\.|[A-Za-z_][\\w.]*)",
  "captures": { "0": { "name": "variable.other.label.txt2bin" },
                "1": { "name": "punctuation.definition.variable.txt2bin" } } }
```

A captura `0` é o trecho inteiro (`$fim`), e a `1` só o `$`. Aceita também `$.`.

**`escapes`**

```json
[ { "name": "constant.character.escape.txt2bin", "match": "\\\\(?:[nrts0\\\\<]|u\\{[0-9A-Fa-f]{1,6}\\})" },
  { "name": "invalid.illegal.escape.txt2bin",   "match": "\\\\." } ]
```

Quatro barras no JSON são uma barra literal na expressão. A primeira regra aceita os escapes válidos (`\n \r \t \s \0 \\ \< \u{…}`); a segunda pinta de vermelho qualquer outra barra seguida de um caractere (`\q`), o mesmo critério do conversor.

**`expressao`** (14 regras, nesta ordem; vírgula e parênteses estão juntos na linha 12 da tabela):

| # | casa | escopo |
|---|---|---|
| 1 | `#…` | comentário (via `#comentario`) |
| 2 | `'A'`, `'\n'` | `constant.character` |
| 3 | `0x1F` | `constant.numeric.hex` |
| 4 | `0b1010` | `constant.numeric.binary` |
| 5 | `0o17` | `constant.numeric.octal` |
| 6 | `1.5`, `.5`, `2e-3` | `constant.numeric.float` |
| 7 | `42`, `1_000` | `constant.numeric.decimal` |
| 8 | `$nome`, `$.` | via `#rotulo` |
| 9 | `sin` **seguido de** `(` | `support.function.math` |
| 10 | `pi`, `tau`, `e`, `inf`, `nan` | `constant.language` |
| 11 | `** // << >> + - * / % & \| ^ ~` | `keyword.operator.arithmetic` |
| 12 | `,` e `( )` | pontuação |
| 13 | qualquer outro nome | `invalid.illegal.identifier` |

Detalhes que importam:

- Hex, binário e octal vêm **antes** do decimal; senão `0x1F` viraria `0` + `x1F`.
- A regra 9 exige o `(` (*lookahead* `(?=\()`): `sin` solto, sem parênteses, cai na regra 13 e fica vermelho, como no conversor ("nome desconhecido").
- Os operadores de dois caracteres (`**`, `//`, `<<`, `>>`) vêm antes dos de um, dentro da mesma alternativa.
- `atan2` vem antes de `atan`, e `log2`/`log10` antes de `log`, pelo mesmo motivo.

**`valor_opcao`**: as regras de `expressao`, **menos** a última (nomes inválidos), **mais** uma regra final que pinta qualquer palavra como `string.unquoted.option`. Assim `org=0x7c00` fica numérico e `mcpu=atmega328p` fica como texto, em vez de vermelho.

**`assembly`** (16 regras). É a parte heurística: a gramática precisa atender dezenas de arquiteturas com sintaxes diferentes, sem saber qual é qual.

| # | casa | escopo | observação |
|---|---|---|---|
| 1 | `${ … }` | `meta.embedded.expression` | bloco `begin`/`end` com as regras de `expressao` (menos comentários) dentro |
| 2 | `;…` | comentário | x86 Intel, AVR, Z80 |
| 3 | `//…` | comentário | ARM64, RISC-V |
| 4 | `#` no começo da linha ou após espaço, **seguido de espaço ou fim** | comentário | não pega o `#5` do ARM, que é um imediato |
| 5 | `@` após espaço e seguido de espaço | comentário | ARM 32 |
| 6 | `"…"` | string | `.ascii "oi"` |
| 7 | `'c'` | string | |
| 8 | `nome:` no começo da linha, opcionalmente seguido de um mnemônico | rótulo (+ mnemônico) | `laco: sbi 0x04, 5` |
| 9 | `.diretiva` no começo da linha | `keyword.control.directive.asm` | `.byte`, `.set` |
| 10 | primeira palavra da linha | `keyword.other.mnemonic.asm` | `mov`, `ldi`, `rjmp` |
| 11 | `.diretiva` após espaço | diretiva | |
| 12 | `offset ptr byte word dword qword tbyte xmmword ymmword short near far` | `storage.type.asm` | sem diferenciar maiúsculas |
| 13 | registradores | `variable.language.register.asm` | ver abaixo |
| 14 | `0x…`, `#0x…`, `1Fh` | número hex | |
| 15 | `42`, `#-4` | número decimal | |
| 16 | `- + * / & \| ^ ~ < > ! =` | operador | |

A regra 13 reconhece três famílias de registradores:

- **com prefixo:** `%rax`, `%d0` (AT&T, m68k) e `$t0`, `$ra` (MIPS). O `$` só conta se **não** for seguido de `{`, para não confundir com `${`;
- **x86:** `[re]?[abcd]x`, `al`/`ah`…, `si`/`di`/`sp`/`bp` com variações, `r8`–`r15` com sufixos `d`/`w`/`b`, segmentos `cs ds es fs gs ss`, `xmm`/`ymm`/`zmm`, `cr0`, `dr0`;
- **RISC:** `r0`–`r99` (ARM, AVR, PPC), `x0`–`x99`, `w`, `v`, `q`, `d`, `s`, `b`, `h` + número (AArch64), `sp lr pc fp xzr wzr`, RISC-V (`zero ra gp tp t0–t6 s0–s11 a0–a7 ft fs fa f`), AVR (`X Y Z SREG`).

É uma lista aproximada. Pode pintar algo que não é registrador (um rótulo chamado `a0`) e deixar de pintar registradores raros.

### 6.4 Um exemplo completo, token por token

Linha 31 do `boot-x86.ttb`:

```text
<<fill 510-($.-$inicio)
```

1. Estamos no nível superior; a regra 7 (`^(<<)(align|fill)\b(.*)$`) casa.
2. Grupo 1 `<<` → `punctuation.definition.directive`; grupo 2 `fill` → `keyword.control.directive`.
3. Grupo 3 ` 510-($.-$inicio)` é tokenizado com `#expressao`:
   `510` decimal · `-` operador · `(` pontuação · `$` + `.` rótulo · `-` operador · `$` + `inicio` rótulo · `)` pontuação.
4. O motor empilha a regra 7 e segue para a linha 32. Ela começa com `<<`, o `end` `(?=^<<)` casa na coluna 0, o bloco termina, e a linha é examinada de novo no nível superior, onde a regra 6 (`<<uint16+`) a pega.

### 6.5 O que a gramática não faz (de propósito)

- Não sabe se um rótulo existe, se um número cabe no tipo, se o hex tem número par de dígitos no total, se a instrução de assembly é válida para a arquitetura. **Tudo isso é dos diagnósticos** (seção 7.3).
- Não colore o assembly de forma diferente por arquitetura. Seria possível (uma regra por família de arquitetura no cabeçalho), mas multiplicaria a gramática.
- Não colore o JSON dentro de um `<<utf8`, porque não há como saber que aquele texto é JSON. Uma ideia futura seria uma anotação, por exemplo `<<utf8 json`, e embutir a gramática `source.json`.

---

## 7. A parte que roda: `src/extension.ts`

### 7.1 Ciclo de vida

O VS Code carrega `dist/extension.js` no Extension Host e chama a função exportada `activate(contexto)` uma vez, quando a extensão é ativada (seção 3). Tudo o que ela registra (provedores, comandos, ouvintes de eventos) é colocado em `contexto.subscriptions`. Quando a extensão é desligada, o VS Code chama `dispose()` em cada item dessa lista e depois `deactivate()`. Aqui `deactivate` não faz nada, porque não há o que fechar além do que já está nas `subscriptions`.

### 7.2 Reaproveitando o conversor

```ts
import { ehErroFonte, formatar, mapa, montar, FORMATOS, type Config, type Formato, type Resultado }
  from '../../../src/index.ts';
```

A extensão importa **o próprio código do txt2bin**, três pastas acima. Não há uma segunda implementação. O `build.ts` (seção 9) copia esse código para dentro de `dist/extension.js`. Consequência: **qualquer mudança no conversor aparece na extensão no próximo build**, e erros e offsets mostrados no editor são exatamente os da linha de comando.

Estado guardado pela extensão:

```ts
const resultados = new Map<string, Resultado>();  // último resultado VÁLIDO de cada documento (chave: URI)
let diagnosticos: vscode.DiagnosticCollection;    // a lista de sublinhados
let saida: vscode.OutputChannel;                  // o painel "Saída → txt2bin"
const mudouHints = new vscode.EventEmitter<void>(); // avisa o VS Code para redesenhar os offsets
```

O mapa `resultados` guarda o último resultado **sem erro**. Enquanto você digita e o arquivo fica momentaneamente inválido, o hover e os offsets continuam mostrando os valores da última versão boa, em vez de sumir.

### 7.3 Análise e diagnósticos (o caminho de um erro)

Ouvintes registrados em `activate`:

```ts
vscode.workspace.onDidOpenTextDocument(d => { if (cfg().get('validacao') !== 'desligada') agendar(d, 0); }),
vscode.workspace.onDidChangeTextDocument(e => { if (cfg().get('validacao') === 'aoDigitar') agendar(e.document, cfg().get('atraso', 400)); }),
vscode.workspace.onDidSaveTextDocument(d => { if (cfg().get('validacao') !== 'desligada') agendar(d, 0); }),
vscode.workspace.onDidCloseTextDocument(d => { diagnosticos.delete(d.uri); resultados.delete(d.uri.toString()); }),
```

No fim de `activate`, `vscode.workspace.textDocuments.forEach(d => agendar(d, 0))` analisa os documentos que já estavam abertos antes da ativação.

**`agendar` (debounce).** Cada tecla gera um evento de mudança. Converter a cada tecla seria desperdício, principalmente com assembly, que chama o `llvm-mc`. Então `agendar` cancela o temporizador anterior daquele documento e marca um novo para daqui a `atraso` ms (400 por padrão). Só a última tecla de uma sequência rápida dispara a análise.

```ts
function agendar(doc, atraso) {
  if (doc.languageId !== LINGUAGEM) return;          // ignora arquivos que não são .ttb
  const k = doc.uri.toString();
  clearTimeout(temporizadores.get(k));
  temporizadores.set(k, setTimeout(() => analisar(doc), atraso));
}
```

**`analisar`.**

```ts
function analisar(doc) {
  try {
    const r = montar(doc.getText(), { config: lerConfig(doc) });   // o conversor de verdade
    resultados.set(doc.uri.toString(), r);
    diagnosticos.set(doc.uri, []);                                  // sem erros: limpa os sublinhados
    mudouHints.fire();                                              // offsets mudaram: redesenhar
    return r;
  } catch (e) {
    const linha = ehErroFonte(e) ? Math.min(Math.max(e.linha - 1, 0), doc.lineCount - 1) : 0;
    const texto = doc.lineAt(linha);
    const intervalo = new vscode.Range(linha, texto.firstNonWhitespaceCharacterIndex, linha, texto.text.length);
    const d = new vscode.Diagnostic(intervalo, e.message, vscode.DiagnosticSeverity.Error);
    d.source = 'txt2bin';
    diagnosticos.set(doc.uri, [d]);
  }
}
```

Pontos importantes:

- **`e.linha - 1`**: o conversor conta linhas a partir de 1 (como as pessoas); o VS Code, a partir de 0.
- **`Math.min`/`Math.max`**: protege contra uma linha fora do documento, que faria o VS Code lançar um erro.
- **O sublinhado cobre a linha inteira**, do primeiro caractere visível ao fim. O conversor informa a linha, mas não a coluna.
- **`ehErroFonte(e)`**, e não `e instanceof ErroFonte`: o empacotador pode duplicar a classe e o `instanceof` falhar (está explicado no `CONTEXTO.md` da raiz).
- Um erro que não é `ErroFonte` (um bug) vai para a linha 1, para pelo menos aparecer.
- **`lerConfig`** procura `txt2bin.config.json` na pasta do arquivo, como o CLI. Se o JSON estiver malformado, é ignorado em silêncio, sem erro. Documentos sem arquivo (`Sem título`) não têm configuração.

**Exemplo de ponta a ponta.** Você digita `(2 +` numa seção `<<uint8` na linha 3 e para de digitar:

1. `onDidChangeTextDocument` → `agendar(doc, 400)`.
2. 400 ms depois, `analisar` → `montar` → `separarTermos` encontra um `(` sem `)` e lança `ErroFonte(3, '"(" sem ")" correspondente')`.
3. `catch` → linha `3 - 1 = 2` → `Diagnostic` da coluna do primeiro caractere até o fim da linha.
4. O VS Code sublinha a linha 3 de vermelho, mostra a mensagem no hover do sublinhado e lista o erro no painel *Problemas*, com a origem "txt2bin".

**Só aparece um erro por vez**, porque o conversor para no primeiro. Corrigido esse, o próximo aparece.

### 7.4 Passar o mouse (hover)

```ts
vscode.languages.registerHoverProvider({ language: 'txt2bin' }, { provideHover(doc, pos) { ... } })
```

O VS Code chama `provideHover` quando o mouse para sobre um ponto. A função:

1. Pega o último resultado válido. Se não houver, não mostra nada.
2. `doc.getWordRangeAtPosition(pos, /\$[A-Za-z_][\w.]*/)`: o mouse está sobre um `$rótulo`? Se sim, mostra `**$fim** = \`62\` · \`0x3E\``.
3. Senão, procura a seção cujo cabeçalho está naquela linha (`itemDaLinha`: `secao.linha === pos.line + 1`) e mostra o cabeçalho, o offset, o tamanho, onde termina e, se for assembly com até 64 bytes, os bytes gerados em hex.

O retorno é um `MarkdownString`, por isso dá para usar negrito e código.

### 7.5 Ir para a definição (F12)

`registerDefinitionProvider`: se o cursor está sobre `$nome`, a função `linhaDoRotulo` procura a linha `<<@nome` e devolve uma `Location`. O VS Code pula até lá com F12 ou Ctrl+clique. É uma busca textual simples, que **funciona mesmo com o arquivo inválido**, porque não depende do conversor.

### 7.6 Offsets no fim da linha (inlay hints)

*Inlay hints* são os textos em cinza que o editor desenha dentro do código sem que eles façam parte do arquivo (como os nomes de parâmetros em TypeScript).

```ts
vscode.languages.registerInlayHintsProvider(sel, {
  onDidChangeInlayHints: mudouHints.event,
  provideInlayHints(doc, faixa) { ... }
})
```

- O VS Code pede as dicas só para a **faixa visível** (`faixa`). O código pula as seções fora dela.
- Para cada seção (menos comentários), cria uma dica no **fim da linha do cabeçalho**: `0x16 · 4 B` para seções com conteúdo, `= 0x3E` para rótulos.
- **`onDidChangeInlayHints`** é como a extensão avisa "as dicas mudaram, peça de novo". O VS Code não sabe sozinho que os offsets mudaram depois de uma análise; por isso `analisar` chama `mudouHints.fire()`.
- A configuração `txt2bin.mostrarOffsets` desliga tudo.

### 7.7 Outline e breadcrumbs

`registerDocumentSymbolProvider` devolve a lista de "símbolos" do documento, que aparece no painel *Outline*, nos *breadcrumbs* (o caminho no topo do editor) e em Ctrl+Shift+O. Também é **textual**, sem o conversor:

- cada linha `<<diretiva` vira um símbolo do tipo `Field`, com o resto do cabeçalho como detalhe;
- cada `<<@rótulo` vira um símbolo do tipo `Key`;
- comentários `<<#` não entram;
- o intervalo de cada seção vai do cabeçalho até a linha antes da próxima diretiva, para o breadcrumb saber em que seção o cursor está.

### 7.8 Comandos

| comando | o que faz |
|---|---|
| `txt2bin.gerar` | analisa; se houver erro, avisa e para. Senão pergunta o formato (`showQuickPick` com `bin hex base64 base64url datauri ihex`), sugere um nome (o `.ttb` trocado por `.bin`, `.hex`, `.b64`…), abre a janela de salvar e grava `formatar(r.bytes, formato)`. É o botão na barra de título do editor. |
| `txt2bin.mapa` | analisa e escreve `mapa(r)` (a mesma tabela do `--map` do CLI) no painel *Saída → txt2bin*. |
| `txt2bin.hex` | analisa e escreve um dump hexadecimal (offset, 16 bytes, ASCII) no mesmo painel. |

Os três trabalham com o editor ativo e só fazem algo se o arquivo for `txt2bin`.

### 7.9 Configurações lidas "ao vivo"

`cfg()` é chamada a cada evento, e não guardada em variável. Assim, mudar uma configuração vale na hora, sem recarregar a janela.

---

## 8. Snippets

Arquivo `snippets/txt2bin.json`. Cada entrada tem um nome, um `prefix` (o que você digita), uma `description` opcional e um `body` (lista de linhas).

| prefixo | gera |
|---|---|
| `glb` | o esqueleto completo de um `.glb`, com os tamanhos de chunk por rótulos |
| `bloco` | `<<uint32+` + `$fim-$ini` + `<<@ini` … `<<@fim` |
| `asm` | `<<assembly(…)` com uma lista de arquiteturas para escolher |
| `boot` | o esqueleto do setor de boot x86 (`org=0x7c00`, `fill`, `55AA`) |
| `@` | `<<@nome` |
| `#` | `<<# ` |

Sintaxe dos marcadores:

| marcador | significado |
|---|---|
| `$1`, `$2` | paradas do Tab, em ordem |
| `${1:padrão}` | parada com texto pré-preenchido |
| `${1\|a,b,c\|}` | parada com lista de escolhas |
| `$0` | onde o cursor termina |
| `\\$` | um `$` literal (necessário nos `$rótulos`, senão o VS Code acha que é um marcador) |

No snippet `bloco`, `${1:+}` deixa o `+` pré-preenchido; apagando, o bloco fica little-endian. O nome dos rótulos (`$2`, `$3`) aparece duas vezes, e o VS Code edita as duas ocorrências juntas.

---

## 9. Build e empacotamento

### 9.1 `build.ts`

```ts
await Bun.build({
  entrypoints: ['src/extension.ts'], outdir: 'dist',
  target: 'node', format: 'cjs', external: ['vscode'], minify: false,
});
```

| opção | por quê |
|---|---|
| `entrypoints` | o ponto de partida; o Bun segue todos os `import`, inclusive o conversor em `../../../src` |
| `target: 'node'` | o Extension Host é Node, não Bun nem navegador |
| `format: 'cjs'` | o VS Code carrega extensões com `require` (CommonJS) |
| `external: ['vscode']` | o módulo `vscode` não existe no disco: o VS Code o injeta quando a extensão é carregada. Ele precisa ficar como `require('vscode')`, sem ser embutido |
| `minify: false` | facilita depurar; o arquivo tem ~65 KB e não precisa encolher |

### 9.2 `tsconfig.json`

Só para checagem (`noEmit`): quem gera JavaScript é o Bun. `allowImportingTsExtensions` permite os `import … from './x.ts'` do conversor. `types: ["node", "bun-types"]` dá os tipos de `node:fs` e de `Bun.build`. A pasta `test` e `scripts` estão incluídas.

### 9.3 `.vscodeignore`

Funciona como um `.gitignore` para o pacote: o que estiver listado não entra no `.vsix`.

```text
node_modules/**   src/**   build.ts   tsconfig.json   bun.lock   .vscode/**
test/**   scripts/**   previa.html   SOBRE-A-EXTENSAO.md
```

O pacote final tem 8 arquivos e ~26 KB: o manifesto, o README, a configuração de linguagem, os snippets, a gramática e o `dist/extension.js`. O `.vsix` é um arquivo ZIP; dá para abrir com qualquer descompactador.

### 9.4 `vsce package`

| opção | por quê |
|---|---|
| `--no-dependencies` | não há dependências de execução (está tudo no bundle) |
| `--skip-license` | a licença é MIT, mas o `LICENSE` fica na raiz do repositório, não nesta pasta |
| `--allow-missing-repository` | de quando não havia repositório; com o `repository` preenchido, pode sair |

O `vsce` também verifica o README: links relativos (`../../README.md`) quebram no Marketplace e fazem o empacotamento falhar sem um repositório configurado. Por isso o README da extensão não tem links para fora da pasta.

---

## 10. Testes sem abrir o VS Code

Tudo roda com `bun test` dentro de `editores/vscode/` (25 testes). O `bunfig.toml` da raiz do repositório limita o `bun test` da raiz à pasta `test/` de lá, para que os testes do conversor e os da extensão não se misturem.

### 10.1 Testes da gramática

**`test/gramatica.ts`** carrega a gramática com **o mesmo motor que o VS Code usa**:

- `vscode-oniguruma` é o Oniguruma compilado em WebAssembly (`onig.wasm`);
- `vscode-textmate` é a implementação do VS Code das regras TextMate (pilha de estados, `begin`/`end`, capturas, `include`).

```ts
await oniguruma.loadWASM(wasm);                       // liga o motor de regex
const registro = new vsctm.Registry({ onigLib, loadGrammar: async () => parseRawGrammar(json) });
const gramatica = await registro.loadGrammar('source.txt2bin');

let estado = vsctm.INITIAL;                            // a pilha começa vazia
for (const linha of fonte.split('\n')) {
  const r = gramatica.tokenizeLine(linha, estado);     // tokens da linha
  estado = r.ruleStack;                                // o estado passa para a próxima linha
}
```

`tokenizar(fonte)` devolve uma lista de `{ texto, escopo, escopos, linha }`, sem os tokens só de espaço. `escopo` é o mais interno; `escopos` é a pilha toda.

**`test/gramatica.test.ts`** usa a função auxiliar `escopo(fonte, texto, linha?)`, que acha um trecho e devolve o escopo sem o sufixo `.txt2bin`. Os testes estão em quatro grupos:

- **diretivas:** `<<`, nome, `+`, rótulo, comentário de seção, diretiva desconhecida, texto antes da primeira diretiva;
- **conteúdo:** texto e escapes (válido e inválido), hex (byte, comentário, inválido), base64 (dados e `=`), expressões (função, constante, rótulo, hex, real, caractere, operador, nome inválido), `fill` (argumento e corpo inválido);
- **assembly:** arquitetura, opções (`mcpu` como texto, `org` como número), rótulo, mnemônico, registrador, número, comentários `;` e `//`, `${…}` e o `#5` do ARM não virar comentário;
- **exemplos do repositório:** nenhum dos 5 `.ttb` de `exemplos/` pode ter **nada** marcado como `invalid`. Esse teste pega regressões amplas: uma mudança na gramática que quebre algo real faz algum exemplo acender em vermelho.

### 10.2 Testes da extensão

O problema: `extension.ts` faz `import * as vscode from 'vscode'`, e esse módulo só existe dentro do VS Code.

A solução: **`test/vscode-falso.ts`**, uma imitação com só o que a extensão usa (`Position`, `Range`, `Diagnostic`, `Hover`, `InlayHint`, `DocumentSymbol`, `EventEmitter`, `window`, `workspace`, `languages`, `commands`…). As funções de registro guardam o que recebem num objeto `registro`:

```ts
registerHoverProvider: (_, p) => (registro.provedores.hover = p),
registerCommand: (nome, f) => (registro.comandos[nome] = f),
createDiagnosticCollection: () => ({ set: (uri, d) => registro.diagnosticos.set(uri.toString(), d), ... }),
```

Também tem `documento(caminho, texto)`, que cria um `TextDocument` falso (`getText`, `lineAt`, `getWordRangeAtPosition`…).

Em **`test/extensao.test.ts`**:

```ts
mock.module('vscode', () => falso);              // a partir daqui, import 'vscode' devolve a imitação
const ext = await import('../src/extension.ts'); // importa DEPOIS do mock
ext.activate({ subscriptions: { push() {} } });
```

`mock.module` é do `bun:test`: troca um módulo por outro para todos os `import` seguintes. Depois, os testes chamam os provedores diretamente, como o VS Code faria:

| teste | verifica |
|---|---|
| registros | os 4 provedores e os 3 comandos foram registrados |
| arquivo válido | sem diagnósticos; o mapa diz `total: 62 bytes` |
| erro | `(2 +` na linha 3 vira diagnóstico na linha 2 (base 0), com a mensagem certa |
| inlay hints | `0x4 · 4 B` na linha 11 e `= 0x16` na 23 do `midi.ttb` |
| hover | `$fim` = 62 / `0x3E`; cabeçalho mostra `offset 18` |
| F12 | `$ini` leva à linha do `<<@ini` |
| outline | a lista exata de seções e rótulos, sem comentários |
| dump hex | começa com `00000000  4d 54 68 64` (`MThd`) |

O que esses testes **não** cobrem: o comportamento visual, os temporizadores de verdade (os testes chamam o comando `mapa`, que analisa na hora), a janela de salvar do comando `gerar` e a integração com o VS Code real.

### 10.3 Prévia visual

`bun run previa` gera `previa.html` com os exemplos coloridos nas cores aproximadas do Dark+ (tabela `TEMA` em `scripts/previa.ts`). Passando o mouse sobre um trecho, aparece o escopo. Serve para conferir mudanças na gramática com os olhos, sem instalar a extensão. As cores são uma aproximação feita à mão; o tema real pode diferir em detalhes (por exemplo, o Dark+ não dá cor própria ao `+` de big-endian).

---

## 11. Desenvolvendo no VS Code de verdade

**F5.** Abra a pasta `editores/vscode/` no VS Code e aperte F5. O `launch.json` roda primeiro a tarefa de build (`tasks.json` → `bun run build`) e depois abre uma **segunda janela do VS Code** (o *Extension Development Host*) com a extensão carregada a partir da pasta, já abrindo `exemplos/`.

```json
{ "type": "extensionHost", "request": "launch",
  "args": ["--extensionDevelopmentPath=${workspaceFolder}", "${workspaceFolder}/../../exemplos"],
  "preLaunchTask": "${defaultBuildTask}" }
```

Na janela de desenvolvimento:

- **Mudou a gramática, a configuração de linguagem ou os snippets:** paleta → *Developer: Reload Window*. Não precisa de build.
- **Mudou `extension.ts` ou o conversor:** rode `bun run build` e recarregue a janela.
- **Pontos de parada** em `src/extension.ts` funcionam na janela original, se o build gerar *source maps* (hoje não gera; acrescente `sourcemap: 'external'` no `build.ts` para isso).
- **Logs:** `console.log` da extensão aparece no *Console de Depuração* da janela original.
- ***Developer: Inspect Editor Tokens and Scopes*** mostra o escopo de qualquer trecho.
- ***Developer: Show Running Extensions*** mostra se a extensão foi ativada e quanto tempo levou.

**Instalar o `.vsix`** no seu VS Code normal: `code --install-extension txt2bin-vscode-0.2.1.vsix`, ou *Extensões* → `…` → *Instalar do VSIX…*. Para atualizar, gere um novo `.vsix` e instale por cima.

---

## 12. Receitas: como mudar coisas

### Uma diretiva nova no conversor (ex.: `<<utf32`)

1. Implemente no conversor (`src/montar.ts`, testes na raiz).
2. Na gramática, acrescente uma regra de seção antes da regra 9. Para `utf32`, basta mudar a regra 3 para `^(<<)(utf16|utf32)(\\+)?\\s*$`.
3. Acrescente um teste em `test/gramatica.test.ts` (escopo do nome, do `+` e do conteúdo).
4. Se fizer sentido, um snippet.
5. `bun test` aqui e na raiz; `bun run previa` para conferir visualmente.

### Uma função nova nas expressões (ex.: `clamp`)

A lista de funções aparece **em três lugares** da gramática: em `repository.expressao`, em `repository.valor_opcao` e dentro do `${…}` de `repository.assembly` (regra 1). As três são cópias (ver seção 14). Mude as três e acrescente um caso no teste de expressões.

### Um registrador ou palavra de assembly

Edite a regra 13 (registradores) ou a 12 (`offset`, `ptr`…) de `repository.assembly`. Cuidado com nomes comuns: tudo o que entrar ali fica colorido como registrador em **todas** as arquiteturas.

### Mudar uma cor

A gramática não define cores. Para mudar a cor de algo no **seu** editor, use `editor.tokenColorCustomizations` nas configurações do VS Code:

```json
"editor.tokenColorCustomizations": {
  "textMateRules": [
    { "scope": "keyword.operator.endianness.txt2bin", "settings": { "foreground": "#FF8C42", "fontStyle": "bold" } }
  ]
}
```

Para mudar para **todos** os usuários, troque o escopo na gramática por outro que os temas já colorem do jeito desejado.

### Uma configuração nova

1. Declare em `contributes.configuration.properties` no `package.json` (tipo, padrão, descrição).
2. Leia com `cfg().get('nome', padrao)` no ponto em que for usada.
3. Se o teste depender dela, acrescente em `registro.config` no `vscode-falso.ts`.

### Um comando novo

1. Declare em `contributes.commands` (e, se quiser, em `menus`).
2. Registre com `vscode.commands.registerCommand('txt2bin.x', …)` dentro de `activate`, colocando o retorno em `ctx.subscriptions`.
3. Teste chamando `registro.comandos['txt2bin.x']()`; atualize o teste "registros".

### Um recurso novo do editor (ex.: autocompletar rótulos)

Siga o modelo dos provedores existentes: `vscode.languages.register<Coisa>Provider(sel, { provide<Coisa>(doc, pos) { … } })`. Para autocompletar, seria `registerCompletionItemProvider` com `$` como caractere de disparo, listando as chaves de `resultados.get(uri).rotulos`. Acrescente o registro correspondente no `vscode-falso.ts`.

---

## 13. Publicação

Antes de publicar, decida e preencha no `package.json`:

- `publisher`: o seu identificador de publicador;
- `license`: já é MIT; copie o `LICENSE` da raiz para esta pasta para tirar o `--skip-license` do script;
- `repository`: já aponta para o GitHub (o `--allow-missing-repository` pode sair, e links relativos no README voltam a funcionar);
- opcionalmente `icon` (PNG 128×128) e `galleryBanner`.

**VS Code Marketplace (Microsoft):**

1. Crie um publicador em `marketplace.visualstudio.com/manage`.
2. Crie um *Personal Access Token* no Azure DevOps com o escopo *Marketplace → Manage*.
3. `bunx vsce login <publisher>` e `bunx vsce publish`.

**Open VSX** (registro usado pelo VSCodium, Cursor, Gitpod e outros editores derivados): conta em `open-vsx.org` e `bunx ovsx publish txt2bin-vscode-0.2.1.vsix -p <token>`.

O processo de publicação pode ter mudado desde a escrita deste documento; confira a documentação oficial de cada registro antes.

---

## 14. Limitações, dívidas e história

### Como a extensão foi feita

Foi escrita em 24/11/2026, numa conversa com o Claude, logo depois da v0.2.0 do conversor. Higor pediu realce no VS Code e, durante o trabalho, definiu a extensão de arquivo `.ttb`.

- A gramática foi **gerada por um script Python**, que montava as regras como dicionários e reaproveitava listas (por isso as cópias de `expressao`). O script não foi guardado. **O JSON é a fonte da verdade** e deve ser editado à mão.
- Os testes de gramática e da extensão foram escritos primeiro como scripts avulsos e depois, a pedido do Higor, transformados nos arquivos de `test/` e `scripts/` descritos aqui.
- Uma imagem da prévia em cores foi gerada com Chrome sem interface para conferir o resultado.

### Dívidas técnicas conhecidas

- **Regras copiadas.** As regras de `expressao` aparecem em três lugares (`expressao`, `valor_opcao` e o `${…}` do assembly), porque cada cópia precisa de uma variação (sem comentários, sem nomes inválidos). TextMate não tem herança. Ao mudar uma, mude as três.
- **Grupos vazios `()`.** As regras 2, 4 e 5 têm um grupo de captura vazio `()` no lugar do `(\\+)?`, resto do gerador. É inofensivo (captura nada), mas pode confundir quem lê.
- **Assembly heurístico.** Uma só gramática para todas as arquiteturas: registradores podem ser pintados onde não são, e vice-versa.
- **Sem *source maps*** no build (ver seção 11).

### Limitações

- **A extensão nunca foi aberta num VS Code real durante o desenvolvimento.** Ela foi verificada pela tokenização com o motor do VS Code, pela imitação da API e pelo empacotamento do `vsce`. Vale um teste manual com F5 antes de publicar.
- **Um erro por vez** (o conversor para no primeiro).
- **Erros sem coluna**: o sublinhado ocupa a linha inteira.
- **Validação ao digitar chama o `llvm-mc`** nas seções de assembly. Há cache por conteúdo no conversor, mas temporários são criados a cada montagem nova. Em arquivos grandes, use `txt2bin.validacao: "aoSalvar"`.
- **`txt2bin.config.json` malformado é ignorado em silêncio** na extensão (no CLI, dá erro).
- **Sem autocompletar** de rótulos, diretivas ou arquiteturas além dos snippets.

### Ideias

- Autocompletar `$rótulos`, nomes de diretivas e de arquiteturas (a lista está em `ARQUITETURAS`).
- Coluna nos erros (exigiria o conversor informar a coluna).
- Vários erros por análise.
- Hover sobre bytes `hex` mostrando o offset de cada byte.
- `<<utf8 json` para colorir o JSON embutido.
- Gerar o `.vsix` e publicar via CI.
- Reaproveitar a gramática no GitHub (Linguist) e no Shiki, para os `.ttb` ficarem coloridos no GitHub e em sites de documentação.

---

## 15. Glossário

| termo | significado |
|---|---|
| **Extension Host** | processo separado, com Node, onde o VS Code roda o código das extensões |
| **ativação** | o momento em que o VS Code carrega a extensão e chama `activate` |
| **contribution / `contributes`** | o que a extensão declara no manifesto (linguagens, gramáticas, comandos…) |
| **gramática TextMate** | regras de expressão regular que dividem o texto em tokens com nomes |
| **Oniguruma** | o motor de expressões regulares usado pelas gramáticas TextMate |
| **token** | um pedaço de texto com seus escopos |
| **escopo** | o nome hierárquico de um token (`constant.numeric.hex.txt2bin`) |
| **tema** | mapeia escopos para cores e estilos |
| **`ruleStack`** | o estado da tokenização passado de uma linha para a próxima |
| **lookahead `(?=…)`** | confere o que vem a seguir sem consumir |
| **diagnóstico** | um problema mostrado no editor (sublinhado + painel Problemas) |
| **provedor** | objeto que o VS Code consulta para um recurso (hover, definição…) |
| **inlay hint** | texto desenhado no editor que não faz parte do arquivo |
| **document symbol** | item do Outline e dos breadcrumbs |
| **debounce** | esperar uma pausa nos eventos antes de agir |
| **`.vsix`** | o pacote instalável de uma extensão (um ZIP) |
| **`vsce`** | ferramenta oficial para empacotar e publicar extensões |
| **Open VSX** | registro aberto de extensões, alternativo ao Marketplace |
