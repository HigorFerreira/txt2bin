#import "../estilo.typ": *

= Comportamento de editor e snippets

Este capítulo trata das duas partes declarativas que não são a gramática: a configuração de linguagem e os snippets. São arquivos JSON curtos, que o VS Code aplica sozinho.

== `language-configuration.json`

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
  "wordPattern": "(\\$[A-Za-z_][\\w.]*)|(-?\\d*\\.\\d\\w*)|([^…\\s]+)",
  "folding": { "markers": { "start": "^<<", "end": "(?=^<<)" } }
}
```

#table(
  columns: (auto, 1fr),
  table.header[campo][efeito],
  [`comments`], [O atalho Ctrl+/ (alternar comentário) põe `#` no começo da linha. É o comentário das seções hex e numéricas. Em `<<utf8` o `#` é texto, e no assembly depende da arquitetura; ali o atalho não ajuda.],
  [`brackets`], [Pares que o editor destaca juntos e usa para colorir parênteses aninhados. `${` com `}` é o par do assembly.],
  [`autoClosingPairs`], [Ao digitar `(`, o editor escreve o `)`; ao digitar `${`, escreve o `}`. O `notIn` evita fechar aspas dentro de texto.],
  [`surroundingPairs`], [Com um trecho selecionado, digitar `(` envolve o trecho em parênteses.],
  [`wordPattern`], [O que conta como "uma palavra" para o duplo clique, o Ctrl+D e o destaque de ocorrências. A primeira alternativa faz `$fim` ser uma palavra só, com o cifrão. Sem ela, o duplo clique em `$fim` selecionaria só `fim`.],
  [`folding`], [Onde blocos podem ser recolhidos: cada `<<diretiva` abre um bloco que vai até a próxima. É o mesmo `(?=^<<)` da gramática.],
)

#experimente[
  Dê um duplo clique em `$fim` na linha 22 do `midi.ttb`: a seleção inclui o cifrão. Para pular dali até a definição, `<<@fim` na linha 43, use F12 (capítulo 5).
]

== Snippets

Os snippets ficam em `snippets/txt2bin.json`. Cada um tem um nome, um prefixo (o que você digita para ele aparecer no autocompletar), uma descrição opcional e um corpo, que é uma lista de linhas.

#table(
  columns: (auto, 1fr),
  table.header[prefixo][gera],
  [`glb`], [o esqueleto completo de um `.glb`, com os tamanhos dos chunks calculados por rótulos. É uma homenagem à origem do projeto (capítulo 2).],
  [`bloco`], [um `<<uint32+` com o tamanho do bloco seguinte, calculado pela diferença entre dois rótulos],
  [`asm`], [um `<<assembly(…)` com uma lista de arquiteturas para escolher],
  [`boot`], [o esqueleto de um setor de boot x86: `org=0x7c00`, preenchimento até 510 bytes e a assinatura `55AA`],
  [`@`], [`<<@nome`],
  [`#`], [`<<# `],
)

=== A sintaxe dos marcadores

#table(
  columns: (auto, 1fr),
  table.header[marcador][significado],
  [`$1`, `$2`], [paradas do Tab, em ordem],
  [`${1:padrão}`], [parada com texto já preenchido],
  [`${1|a,b,c|}`], [parada com uma lista de escolhas],
  [`$0`], [onde o cursor termina],
  [`\\$`], [um cifrão literal],
)

O último marcador é o detalhe mais traiçoeiro deste arquivo. Nos snippets, `$` inicia um marcador. Mas os rótulos do txt2bin também começam com `$`. Para escrever `$fim` num snippet é preciso escapar o cifrão, e como o arquivo é JSON, a barra também é dobrada: `\\$fim`.

O snippet `bloco` mostra vários marcadores juntos:

```json
"body": ["<<uint32${1:+}", "\\$${2:fim}-\\$${3:ini}", "<<@$3", "$0", "<<@$2"]
```

Ao expandir:

+ o cursor para no `+`, já preenchido. Apagando, o bloco fica little-endian;
+ depois no nome do rótulo de fim e depois no de início. Como `$2` e `$3` aparecem duas vezes cada, o VS Code edita as duas ocorrências juntas;
+ por fim, o cursor vai para `$0`, entre os dois rótulos, onde o conteúdo do bloco deve ser escrito.

O resultado, com os nomes padrão:

```text
<<uint32+
$fim-$ini
<<@ini
(cursor aqui)
<<@fim
```

É exatamente o padrão das linhas 21 a 43 do `midi.ttb`.
