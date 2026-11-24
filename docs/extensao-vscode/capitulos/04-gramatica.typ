#import "../estilo.typ": *

= As cores: a gramática TextMate

== O formato

O VS Code colore código com *gramáticas TextMate*, um formato criado para o editor TextMate (macOS, 2004) e adotado por VS Code, Sublime Text, GitHub e Shiki. Uma gramática é uma lista de *regras com expressões regulares*. O motor de expressões regulares é o *Oniguruma*, o mesmo do Ruby, que aceita _lookahead_ `(?=…)`, _lookbehind_ `(?<=…)` e grupos de captura.

A gramática do txt2bin está em `syntaxes/txt2bin.tmLanguage.json`.

== Como o motor lê o arquivo

O motor trabalha *linha por linha*. Para cada linha:

+ procura, entre as regras ativas naquele momento, a que casa *mais cedo* na linha;
+ dá um nome ao trecho casado;
+ continua do ponto onde parou, até o fim da linha.

O que liga uma linha à próxima é o *estado*, chamado `ruleStack`: uma pilha que diz "estou dentro da regra X, que está dentro da Y". É graças a ela que a décima linha de um bloco `<<assembly` sabe que está dentro de um assembly, mesmo sem nenhum `<<` nela.

#fluxo[linha 1 + pilha vazia][tokens + pilha][linha 2 + pilha][tokens + pilha][…]

== Os três tipos de regra

*1. `match`: um trecho dentro de uma linha.*

```json
{ "name": "constant.numeric.hex.txt2bin", "match": "\\b0[xX][0-9A-Fa-f_]+\\b" }
```

Tudo o que casar com a expressão (por exemplo `0x1F`) recebe o nome `constant.numeric.hex.txt2bin`.

#nota[
  As barras invertidas aparecem dobradas porque o arquivo é JSON: `"\\b"` no arquivo é `\b` na expressão regular. Quatro barras no JSON são uma barra literal na expressão. Esse é o principal motivo de a gramática ser difícil de ler.
]

*2. `begin`/`end`: um bloco que pode ter várias linhas.*

```json
{
  "begin": "^(<<)(hex)()\\s*$",
  "end": "(?=^<<)",
  "patterns": [ ...regras que valem dentro do bloco... ]
}
```

Quando `begin` casa, o motor entra no bloco e empilha a regra. A partir daí, só valem as regras de `patterns`, mais o `end`. Quando `end` casa, o bloco termina e a regra sai da pilha.

*3. `include`: reaproveitar regras.*

```json
{ "include": "#expressao" }
```

Copia, naquele ponto, as regras guardadas em `repository.expressao`. O `repository` é um dicionário de grupos de regras com nome, para não repetir.

== Capturas e `contentName`

Os grupos entre parênteses da expressão podem receber nomes próprios:

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

Em `<<@fim`, o `<<` (grupo 1), o `@` (grupo 2) e `fim` (grupo 3) ganham nomes diferentes e, portanto, podem ter cores diferentes. Nas regras `begin`/`end`, o equivalente é `beginCaptures` e `endCaptures`.

Uma captura pode ter `patterns` em vez de `name`: o trecho capturado é analisado *de novo* com essas regras. É assim que o resto da linha `<<fill 510-($.-$inicio)` vira uma expressão colorida.

Já o `contentName` dá um nome a *tudo o que fica entre* `begin` e `end`. Em `<<utf8`, ele vale `string.unquoted.text.txt2bin`: o texto inteiro da seção fica com cor de string, e as regras internas (os escapes) pintam só os pedaços especiais por cima.

== De nome a cor: escopos e temas

O nome dado a um trecho se chama *escopo*. Um trecho não tem um escopo só, mas uma *pilha* deles, do mais externo ao mais interno. Por exemplo, o `fim` dentro de `${$fim}` num bloco de assembly tem esta pilha (são dados reais, tirados do motor):

```text
source.txt2bin
meta.embedded.block.assembly.txt2bin
meta.embedded.expression.txt2bin
variable.other.label.txt2bin
```

*A gramática não escolhe cores.* Quem escolhe é o *tema* que o usuário usa (Dark+, Monokai…). O tema tem regras como "`comment` em verde" e "`constant.numeric` em verde-claro". Uma regra vale para todo escopo que comece com aquele prefixo: `constant.numeric` pega `constant.numeric.hex.txt2bin`. Se várias regras casam, vence a mais específica.

Por isso *os nomes seguem convenções*. Um tema não conhece o txt2bin, mas sabe colorir `comment`, `string`, `constant.numeric`, `keyword`, `entity.name`, `variable` e `invalid`. Usando esses prefixos, o txt2bin fica bonito em qualquer tema. O sufixo `.txt2bin` existe para quem quiser dar uma cor só ao txt2bin.

#table(
  columns: (auto, 1fr, auto),
  table.header[escopo (sem `.txt2bin`)][onde aparece][no Dark+],
  [`punctuation.definition.directive`], [o `<<`], [roxo],
  [`keyword.control.directive`], [`utf8`, `hex`, `uint32`, `assembly`…], [roxo],
  [`keyword.operator.endianness`], [o `+` de big-endian], [cinza claro],
  [`entity.name.label`], [o nome em `<<@nome`; `nome:` no assembly], [amarelo],
  [`comment.block.section`], [seções `<<#` inteiras], [verde],
  [`comment.line.*`], [comentários de linha], [verde],
  [`string.unquoted.text`], [texto de `utf8` e `utf16`], [salmão],
  [`constant.character.escape`], [`\n`, `\u{e9}`], [dourado],
  [`constant.numeric.*`], [números e bytes hex], [verde-claro],
  [`constant.language`], [`pi`, `tau`, `e`, `inf`, `nan`], [azul],
  [`support.function.math`], [`sin`, `round`…], [amarelo],
  [`variable.other.label`], [rótulos como `$fim` e `$.`], [azul-claro],
  [`keyword.operator.*`], [operadores], [cinza claro],
  [`entity.name.type.architecture`], [`avr` em `<<assembly(avr)`], [verde-água],
  [`variable.parameter.option`], [`org`, `mcpu`], [azul-claro],
  [`keyword.other.mnemonic.asm`], [`mov`, `sbi`, `rjmp`], [azul],
  [`variable.language.register.asm`], [`rax`, `r18`, `x0`], [azul vivo],
  [`invalid.illegal.*`], [erros de forma], [vermelho],
)

#experimente[
  No VS Code, abra a paleta e escolha *Developer: Inspect Editor Tokens and Scopes*. Clique em qualquer trecho de um `.ttb` e veja a pilha de escopos e a regra do tema que deu a cor. É a ferramenta mais útil para mexer em gramáticas.
]

== O truque central: `(?=^<<)`

Todo bloco de seção termina com o mesmo `end`:

```text
(?=^<<)
```

Lendo: "termina *logo antes* de uma linha que comece com `<<`". O `(?= )` é um _lookahead_: confere o que vem a seguir sem consumir. Assim, o `<<` da próxima seção *não é engolido* pelo fim da anterior e pode ser casado pela regra da próxima seção. O `^` exige a coluna 0, a mesma regra do conversor: um `<<` no meio da linha, como em `192 >> 7` ou `1 << 4`, não fecha nada.

Consequência: cada seção é um bloco, e o conteúdo dela só é colorido pelas regras daquela seção. O mesmo `#` é comentário dentro de `<<hex`, texto dentro de `<<utf8` e depende do contexto dentro de `<<assembly`.

== As 11 regras de nível superior

Quando duas regras casam na mesma posição, *vence a que vem primeiro na lista*. Por isso a regra genérica de "diretiva desconhecida" fica depois das específicas.

#table(
  columns: (auto, auto, 1fr),
  table.header[nº][casa][efeito],
  [0], [`<<#…`], [seção de comentário: tudo verde até a próxima diretiva, cabeçalho incluído],
  [1], [`<<@nome`], [rótulo. É `match`, não bloco: rótulo não tem conteúdo],
  [2], [`<<utf8`], [texto com escapes],
  [3], [`<<utf16` e `<<utf16+`], [texto com escapes; o `+` ganha o escopo de ordem de bytes],
  [4], [`<<hex`], [comentários, pares de dígitos hex e, por fim, qualquer outro caractere em vermelho],
  [5], [`<<base64`, `<<base64url`], [alfabeto, o `=` de preenchimento e o resto em vermelho],
  [6], [`<<uint8` … `<<float64`, com ou sem `+`], [os 11 tipos numéricos numa regra só; o corpo é expressão],
  [7], [`<<align`, `<<fill`], [a expressão está no cabeçalho; qualquer coisa no corpo fica vermelha],
  [8], [`<<assembly(arq) opções`], [arquitetura, opções `chave=valor` e o corpo como assembly],
  [9], [qualquer outro `<<…`], [diretiva desconhecida, em vermelho],
  [10], [texto fora de seção], [vermelho: antes da primeira diretiva ou depois de um rótulo],
)

Alguns detalhes que ligam a gramática ao conversor:

- O `utf8` *não aceita* `+`: `<<utf8+` não casa a regra 2 e cai na 9, ficando vermelho. O conversor também recusa, porque UTF-8 não tem ordem de bytes.
- Na regra 4, cada *par* de dígitos é um token. Um dígito sobrando sozinho (`0a b`) fica vermelho, porque não forma um byte.
- A regra 5 não distingue os dois alfabetos de base64: um `-` dentro de `<<base64` não fica vermelho. Quem acusa é o conversor, com a dica "isso é base64url?".
- A regra 8 tem três níveis de captura: a linha inteira, depois cada `chave=valor`, depois o valor, analisado como expressão (`org=0x7c00` fica numérico) ou como texto (`mcpu=atmega328p`).

== Os grupos do `repository`

#table(
  columns: (auto, auto, 1fr),
  table.header[grupo][regras][o que reconhece],
  [`comentario`], [1], [`#` até o fim da linha],
  [`rotulo`], [1], [rótulos com cifrão, inclusive `$.` (a posição atual)],
  [`escapes`], [2], [escapes válidos (`\n \r \t \s \0 \\ \< \u{…}`) e, em vermelho, qualquer outra barra seguida de caractere],
  [`expressao`], [14], [comentários, caracteres, números em todas as bases, rótulos, funções, constantes, operadores, pontuação e, em vermelho, nomes desconhecidos],
  [`valor_opcao`], [14], [como `expressao`, mas um nome desconhecido vira texto em vez de erro],
  [`assembly`], [16], [`${…}`, comentários de várias famílias, strings, rótulos, diretivas, mnemônicos, registradores, números e operadores],
)

=== A ordem dentro de `expressao`

A ordem resolve ambiguidades:

- hexadecimal, binário e octal vêm *antes* do decimal; senão `0x1F` viraria `0` seguido de `x1F`;
- uma função só é reconhecida quando *seguida de* `(`. Um `sin` solto cai na última regra e fica vermelho, como no conversor ("nome desconhecido");
- os operadores de dois caracteres (`**`, `//`, `<<`, `>>`) vêm antes dos de um;
- `atan2` vem antes de `atan`, e `log2`/`log10` antes de `log`, pelo mesmo motivo.

=== O assembly é heurístico

Uma única gramática atende dezenas de arquiteturas com sintaxes diferentes, sem saber qual é qual. Por isso ela adivinha:

- comentários com `;` (x86 Intel, AVR), `//` (ARM64, RISC-V), `@` entre espaços (ARM 32) e `#` seguido de espaço. O `#5` do ARM, que é um número, não vira comentário;
- a primeira palavra da linha é um mnemônico; `nome:` no começo da linha é um rótulo;
- registradores vêm de uma lista que junta x86 (`rax`, `al`, `xmm0`), RISC (`r0`, `x0`, `sp`, `lr`), RISC-V (`a0`, `t0`), AVR (`X`, `Y`, `Z`) e os prefixados (`%rax`, `$t0`).

Essa lista pode pintar algo que não é registrador (um rótulo chamado `a0`) e deixar de pintar registradores raros.

== Um exemplo real, token por token

Estes são os tokens que o motor do VS Code produz para quatro linhas (saída real do teste de gramática):

```text
<<uint32+
$fim-$ini       # tamanho
<<assembly(avr) mcpu=atmega328p
laco: sbi 0x05, 5 ; liga
```

#table(
  columns: (auto, auto, 1fr),
  table.header[linha][trecho][escopo mais interno],
  [1], [`<<`], [`punctuation.definition.directive`],
  [1], [`uint32`], [`keyword.control.directive`],
  [1], [`+`], [`keyword.operator.endianness`],
  [2], [`$`], [`punctuation.definition.variable` (dentro de `variable.other.label`)],
  [2], [`fim`], [`variable.other.label`],
  [2], [`-`], [`keyword.operator.arithmetic`],
  [2], [`# tamanho`], [`comment.line.number-sign`],
  [3], [`avr`], [`entity.name.type.architecture`],
  [3], [`mcpu`], [`variable.parameter.option`],
  [3], [`atmega328p`], [`string.unquoted.option`],
  [4], [`laco`], [`entity.name.label.asm`],
  [4], [`sbi`], [`keyword.other.mnemonic.asm`],
  [4], [`0x05`], [`constant.numeric.hex.asm`],
  [4], [`; liga`], [`comment.line.semicolon.asm`],
)

O caminho do motor:

+ Linha 1: estamos no nível superior; a regra 6 casa. O motor empilha o bloco numérico.
+ Linha 2: dentro do bloco, valem as regras de `expressao`. Rótulos, operador e comentário são reconhecidos.
+ Linha 3: começa com `<<` na coluna 0. O `end` do bloco numérico casa *antes* de qualquer caractere, o bloco sai da pilha e a linha é examinada de novo no nível superior, onde a regra 8 a pega.
+ Linha 4: dentro do bloco de assembly, as regras de `assembly` reconhecem rótulo, mnemônico, número e comentário.

== O que a gramática não faz, de propósito

- Não sabe se um rótulo existe, se um número cabe no tipo, se o hex tem número par de dígitos no total ou se uma instrução existe na arquitetura. *Tudo isso é dos diagnósticos* (capítulo 5).
- Não colore o assembly de forma diferente por arquitetura. Seria possível, com uma regra por família no cabeçalho, mas multiplicaria o tamanho da gramática.
- Não colore o JSON dentro de um `<<utf8`, porque não há como saber que aquele texto é JSON. Uma ideia futura é uma anotação como `<<utf8 json`, que embutiria a gramática de JSON.
