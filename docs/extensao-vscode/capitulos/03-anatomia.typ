#import "../estilo.typ": *

= Anatomia de uma extensão

== As duas metades

Uma extensão de linguagem tem *duas metades* que funcionam de jeitos completamente diferentes.

*A metade declarativa* é feita só de arquivos JSON. O VS Code lê esses arquivos e faz o trabalho sozinho, *sem executar nenhum código nosso*:

- a *gramática* diz como dividir o texto em pedaços e que nome cada pedaço tem. É daí que vêm as cores;
- a *configuração de linguagem* diz qual é o caractere de comentário, que pares de parênteses fechar sozinho e o que conta como "palavra" no duplo clique;
- os *snippets* são modelos de texto que o autocompletar oferece.

*A metade programática* é um programa em TypeScript (`src/extension.ts`) que o VS Code executa num processo separado, o *Extension Host*, com Node. Ela faz o que exige *entender* o arquivo: converter, achar erros, calcular offsets, saber quanto vale um rótulo.

#figure(
  grid(
    columns: (1fr, 1fr),
    column-gutter: 14pt,
    row-gutter: 8pt,
    align(center, text(weight: "bold", fill: azul)[declarativa (JSON)]),
    align(center, text(weight: "bold", fill: verde)[programática (TypeScript)]),
    fluxo-vertical[gramática][escopos][tema do usuário][*cores*],
    fluxo-vertical[`extension.ts`][`montar()` do conversor][resultado ou erro][*sublinhados, hover, offsets, comandos*],
  ),
  kind: image,
  caption: [As duas metades. Cada uma funciona mesmo com a outra quebrada.],
)

Essa divisão explica uma coisa que confunde no começo: *as cores e os erros são independentes*. A gramática não sabe que um rótulo `$nada` não existe; ela só vê o formato "cifrão seguido de nome" e pinta como rótulo. Quem descobre que o rótulo não existe é o conversor, rodando em `extension.ts`, que então sublinha a linha.

#experimente[
  Num `.ttb`, troque `$fim` por `$nada` na linha 22 do `midi.ttb`. A cor não muda (para a gramática, continua sendo um rótulo), mas a linha fica sublinhada com a mensagem do conversor.
]

== Mapa dos arquivos

Tudo fica em `editores/vscode/`:

#table(
  columns: (auto, 1fr, auto),
  table.header[arquivo][papel][capítulo],
  [`package.json`], [manifesto: o que a extensão oferece ao VS Code], [3],
  [`syntaxes/txt2bin.tmLanguage.json`], [gramática TextMate: as cores], [4],
  [`src/extension.ts`], [a parte que roda], [5],
  [`language-configuration.json`], [comentários, parênteses, palavras, dobras], [6],
  [`snippets/txt2bin.json`], [modelos do autocompletar], [6],
  [`build.ts`], [junta extensão e conversor num arquivo só], [7],
  [`tsconfig.json`], [checagem de tipos], [7],
  [`.vscodeignore`], [o que não entra no pacote], [7],
  [`.vscode/launch.json`, `tasks.json`], [o F5 que abre um VS Code de teste], [7],
  [`test/`], [25 testes (gramática e lógica)], [8],
  [`scripts/previa.ts`], [gera uma prévia colorida em HTML], [8],
  [`README.md`], [página da extensão no Marketplace], [—],
  [`SOBRE-A-EXTENSAO.md`], [versão de consulta deste guia], [—],
  [`dist/extension.js`], [(gerado) o que o VS Code executa], [7],
)

Comandos, sempre dentro de `editores/vscode/`:

#table(
  columns: (auto, 1fr),
  table.header[comando][o que faz],
  [`bun install`], [instala as dependências de desenvolvimento],
  [`bun test`], [roda os 25 testes],
  [`bun run typecheck`], [checa os tipos com o `tsc`],
  [`bun run build`], [gera `dist/extension.js`],
  [`bun run previa`], [gera `previa.html`],
  [`bun run package`], [typecheck, testes, build e, por fim, o `.vsix`],
)

== O manifesto: `package.json`

O manifesto é um `package.json` comum de npm, com campos a mais que só o VS Code entende. É a "carteira de identidade" da extensão: o VS Code o lê *antes* de executar qualquer código, e é por ele que sabe quando ativar a extensão e o que ela acrescenta ao editor.

```json
{
  "name": "txt2bin-vscode",
  "displayName": "txt2bin",
  "version": "0.2.0",
  "publisher": "seu-publisher",
  "license": "MIT",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Programming Languages", "Linters"],
  "main": "./dist/extension.js",
  "activationEvents": [],
  "contributes": { ... }
}
```

- `name` e `publisher` juntos formam o identificador único da extensão. O `publisher` ainda é um marcador (`seu-publisher`) que precisa ser trocado antes de publicar.
- `engines.vscode` é a versão mínima do VS Code. Ela casa com a versão dos tipos usados no código (`@types/vscode` 1.85).
- `main` aponta para o arquivo que o Extension Host executa. Note que é o arquivo *gerado* em `dist/`, não o `.ts`.

=== Ativação e o `activationEvents` vazio

Uma extensão não roda desde que o VS Code abre: ela é *ativada* quando acontece um evento, para não pesar na inicialização. Desde o VS Code 1.74, declarar uma linguagem já cria o evento implícito "abriu um arquivo dessa linguagem", e declarar um comando já cria "chamaram esse comando". Por isso a lista fica vazia: a extensão acorda sozinha quando você abre um `.ttb` ou chama um dos comandos.

=== `contributes`: o que a extensão acrescenta

#table(
  columns: (auto, 1fr),
  table.header[chave][efeito],
  [`languages`], [cria a linguagem `txt2bin` e diz que arquivos `.ttb` são dela. Sem isso, nada mais se aplica.],
  [`grammars`], [liga a gramática (`source.txt2bin`) à linguagem],
  [`snippets`], [liga os snippets à linguagem],
  [`commands`], [põe os três comandos na paleta (Ctrl+Shift+P), na categoria "txt2bin"],
  [`menus`], [põe o botão "Gerar arquivo binário" na barra de título do editor, só quando o arquivo é `.ttb`],
  [`configuration`], [cria a página de configurações `txt2bin.validacao`, `txt2bin.atraso` e `txt2bin.mostrarOffsets`],
)

#cuidado[
  Declarar um comando no manifesto *não basta para ele funcionar*. O código também precisa registrar o mesmo identificador com `vscode.commands.registerCommand` (capítulo 5). Se faltar o registro, o comando aparece na paleta, mas dá erro ao ser chamado.
]

=== Sem dependências de execução

A extensão não tem nenhuma dependência de execução. Tudo o que ela usa, inclusive o conversor inteiro, é embutido no `dist/extension.js` pelo build. As dependências do `package.json` são todas de desenvolvimento: tipos, TypeScript, o empacotador `vsce` e o motor de realce usado nos testes.
