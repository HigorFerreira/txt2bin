#import "../estilo.typ": *

= Como tudo começou

A extensão é a ponta de uma cadeia de ideias, cada uma nascida da anterior, em dois dias de conversa entre o Higor e o Claude (23 e 24 de novembro de 2026). Para entender por que ela é como é, vale seguir a cadeia desde o começo.

#fluxo[um armário][um arquivo `.glb`][glTF byte a byte][um formato de texto][o txt2bin][a extensão]

== Um armário com rodinhas

O ponto de partida não tinha nada a ver com binários. O Higor queria projetar um armário com rodinhas para montar dentro de um apartamento, com as peças subindo pelo elevador. Depois de comparar Fusion, SolidWorks, SketchUp, Promob e FreeCAD, a escolha foi um *modelo paramétrico em código*, com build123d e o OCP CAD Viewer. O script gerava a lista de corte, as ferragens, o peso de cada peça e as validações do prédio, e exportava o modelo como `armario.glb`.

== O glTF escrito à mão

Para entender o que havia dentro daquele `.glb`, o Higor quis *escrever arquivos glTF à mão, byte a byte*. Escrever bytes num editor hexadecimal é penoso; então ele propôs um formato de texto simples:

```text
<<utf8
Coisas em strings escritas, json etc\n
<<hex
04ff2345ab5f2c
<<uint8
19
```

As regras, nas palavras dele: "`<<` + o que será escrito + quebra de linha + conteúdo até o fim do arquivo ou outro `<<`"; "as quebras de linha são escapadas com `\n`; na conversão as quebras de linha são ignoradas e o próximo byte é imediatamente anexado"; "então precisamos de escape para `<`".

Esse rascunho já contém a ideia central de tudo o que veio depois: *um arquivo é uma sequência de seções, e cada seção diz como o seu conteúdo vira bytes.*

#bastidores[
  A primeira versão do conversor foi um `txt2bin.js` para Node, sem dependências. Ela foi além do pedido: ganhou `float32` (indispensável para vértices), alinhamento, rótulos, expressões como `$a-$b`, comentários e um mapa de seções. Junto vieram um guia em Typst chamado "glTF do zero", um visualizador em three.js e cinco modelos (face, cubo, esfera, spline, mesa com vaso), todos aprovados pelo validador oficial da Khronos. Esse material vive num projeto de estudo separado. Este guia, também em Typst, segue a mesma linha.
]

== O formato vira projeto

Na manhã de 24/11, o Higor percebeu que *o formato e o conversor eram interessantes por si sós*, independentemente do glTF, e pediu:

- reescrever tudo em TypeScript para rodar no Bun;
- seções `base64` e `base64url`;
- operações aritméticas;
- big-endian marcado com `+` (como em `<<float32+`), depois de perguntar por que tudo era little-endian;
- `<<assembly(tipo)` "para todos os tipos de assembly: `intel_x86`, apple silicon, arm, atmel etc.";
- uma pesquisa de projetos parecidos, porque a ideia era publicar no npm.

Daí saiu a versão 0.2.0 do conversor. Uma decisão dessa fase afeta diretamente a extensão: *uma diretiva só abre com `<<` na coluna 0*. Na v1, `<<` em qualquer posição abria uma seção. Com as expressões, `<<` e `>>` viraram operadores de deslocamento (a linha 39 do exemplo usa `192 >> 7`), e era preciso distinguir os dois usos. Como veremos no capítulo 4, a gramática de cores inteira se apoia nessa regra.

== O pedido do realce e o nome `.ttb`

Com o conversor pronto, o Higor pediu realce de sintaxe no VS Code. No meio do trabalho, definiu: *"O arquivo de nossa sintaxe pode ser um `.ttb`"*. Até ali os exemplos não tinham uma extensão própria; eles foram renomeados, e a extensão do VS Code passou a reconhecer `.ttb`.

O pedido era só de cores, mas a extensão foi além, pelo mesmo motivo que a v1 tinha ido: o conversor já sabia tudo sobre o arquivo (onde cada seção começa, quanto mede, quanto vale cada rótulo, onde está o erro). Bastava perguntar a ele e mostrar a resposta no editor. Daí vieram os diagnósticos, o hover, os offsets e os comandos.

#bastidores[
  - A gramática de cores foi *gerada por um script Python* que montava as regras como dicionários e reaproveitava listas. O script não foi guardado. Desde então, *o JSON é a fonte da verdade* e é editado à mão. Isso explica algumas esquisitices que o capítulo 9 descreve, como as regras de expressão copiadas em três lugares.
  - Os testes nasceram como scripts avulsos e, a pedido do Higor, viraram os arquivos de `test/` e `scripts/` que existem hoje.
  - Para conferir as cores, uma prévia foi renderizada como imagem com o Chrome sem interface.
  - *A extensão nunca foi aberta num VS Code de verdade durante a conversa.* Ela foi verificada pelo motor de realce do próprio VS Code, por uma imitação da API e pelo empacotador oficial. O `.vsix` que o Higor instalou é o primeiro teste real.
]

== Do zip ao repositório

O repositório git começou depois da conversa, com o código já maduro:

#marco[24/11, 12:44][`initial commit`: conversor, testes do conversor, exemplos e a extensão (ainda sem os testes dela).]
#marco[12:58 e 13:08][Dois commits só de formatação (espaços).]
#marco[13:08][O pacote instalável `txt2bin-vscode-0.1.0.vsix` entra no repositório.]
#marco[13:35 e 13:51][O `CONTEXTO.md` com a história e as decisões.]
#marco[13:57][A exportação final da conversa (um zip) trouxe os 25 testes da extensão, a prévia em HTML, o `bunfig.toml` e o `SOBRE-A-EXTENSAO.md`, organizados no commit `4bd8e7a`.]
#marco[tarde][Este guia.]

== O que a história explica

Várias características da extensão, que parecem arbitrárias à primeira vista, vêm direto dessa história:

#table(
  columns: (1fr, 1.3fr),
  table.header[característica][origem],
  [A extensão importa o próprio conversor em vez de reimplementá-lo.], [O conversor já existia e era a referência; duas implementações divergiriam.],
  [Todo bloco da gramática termina em "logo antes de `<<` na coluna 0".], [A regra da coluna 0, criada para os operadores `<<` e `>>`.],
  [Tudo em português: comandos, configurações, mensagens.], [O idioma do autor e de todo o projeto.],
  [Snippets de `.glb` e de setor de boot.], [O glTF é a origem do projeto; o setor de boot é o exemplo de assembly mais clássico.],
  [`ehErroFonte(e)` em vez de `instanceof`.], [Um bug real do empacotamento, visto no capítulo 5.],
  [A gramática é um JSON grande com partes repetidas.], [Foi gerada por um script que não foi guardado.],
)
