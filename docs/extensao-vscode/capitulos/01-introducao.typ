#import "../estilo.typ": *

= Introdução

O *txt2bin* é uma linguagem para escrever arquivos binários em texto puro. Um arquivo `.ttb` mistura, no mesmo lugar, bytes em hexadecimal, texto, base64, números de 8 a 64 bits em qualquer ordem de bytes, expressões com rótulos que se resolvem sozinhos e trechos de assembly de mais de 30 arquiteturas. O conversor lê o `.ttb` e escreve o binário.

A *extensão do VS Code* é o que torna esses arquivos agradáveis de editar. Este guia explica como ela funciona por dentro e conta como ela nasceu.

== O que a extensão faz

Abra um `.ttb` com a extensão instalada e você ganha:

- *cores*: diretivas, rótulos, texto, escapes, bytes, números, operadores, funções e assembly, cada um com sua cor;
- *erros enquanto digita*: a linha com problema fica sublinhada em vermelho, com a mesma mensagem que o conversor daria na linha de comando, inclusive os erros do montador de assembly;
- *offsets no fim da linha*: cada cabeçalho `<<diretiva` mostra, em cinza, onde a seção começa no arquivo final e quantos bytes ela ocupa;
- *passar o mouse*: sobre um rótulo, o valor dele; sobre um cabeçalho, offset e tamanho;
- *F12* num rótulo leva até onde ele é definido;
- *Outline e breadcrumbs* com as seções e os rótulos;
- *comandos* para gerar o binário, ver o mapa de seções e ver um dump hexadecimal;
- *snippets* para esqueletos comuns (um `.glb`, um setor de boot, um bloco com tamanho).

== O exemplo que acompanha o guia

Para não ficar no abstrato, quase todos os capítulos usam o mesmo arquivo: `exemplos/midi.ttb`, que gera um MIDI de 62 bytes tocando um arpejo de dó maior. As partes que vamos citar:

```text
 9  <<utf8
10  MThd
11  <<uint32+
12  6               # tamanho dos dados do cabeçalho
13  <<uint16+
14  0               # formato 0: uma única trilha
15  1               # número de trilhas
16  96              # tiques por semínima
    ...
19  <<utf8
20  MTrk
21  <<uint32+
22  $fim-$ini       # tamanho da trilha, calculado pelos rótulos
23  <<@ini
    ...
26  <<hex
27  00 C0 00        # delta 0: instrumento 0 (piano)
    ...
38  <<uint8
39  (0x80 | (192 >> 7))  (192 & 0x7F)
40  <<hex
    ...
43  <<@fim
```

Os números à esquerda são as linhas do arquivo. A linha 22 é o coração do exemplo: o tamanho da trilha é `$fim-$ini`, a distância entre dois rótulos que só são definidos depois. O conversor descobre sozinho que essa distância é 40 bytes.

== Como ler este guia

#table(
  columns: (auto, auto, 1fr),
  table.header[cap.][assunto][para quem],
  [2], [História], [quem quer saber de onde a extensão veio e por que ela é como é],
  [3], [Anatomia], [quem nunca fez uma extensão de editor: as duas metades, o manifesto],
  [4], [Gramática], [quem quer entender ou mudar as cores],
  [5], [Código], [quem quer entender ou mudar erros, hover, offsets e comandos],
  [6], [Editor], [comentários, parênteses, dobras e snippets],
  [7], [Build], [como o código vira um `.vsix` instalável],
  [8], [Testes], [como tudo é testado sem abrir o VS Code],
  [9], [Receitas], [passo a passo para mudanças comuns, limitações e próximos passos],
)

Os capítulos 3 a 5 são o núcleo. Os outros podem ser lidos em qualquer ordem.

#nota[
  A especificação completa da linguagem está em `docs/especificacao.md`. O raciocínio por trás das decisões do conversor está no `CONTEXTO.md`. Uma versão de consulta deste guia, em Markdown e mais seca, está em `editores/vscode/SOBRE-A-EXTENSAO.md`.
]
