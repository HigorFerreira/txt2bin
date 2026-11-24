#import "../estilo.typ": *

= Receitas, limites e próximos passos

== Receitas

=== Uma diretiva nova (por exemplo, `<<utf32`)

+ Implemente no conversor (`src/montar.ts`), com testes na raiz.
+ Na gramática, acrescente uma regra de seção *antes* da regra 9 (diretiva desconhecida). Para `utf32`, basta ampliar a regra 3: `^(<<)(utf16|utf32)(\\+)?\\s*$`.
+ Acrescente um teste em `test/gramatica.test.ts` com o escopo do nome, do `+` e do conteúdo.
+ Se fizer sentido, um snippet.
+ Rode `bun test` aqui e na raiz, e `bun run previa` para conferir com os olhos.

=== Uma função nova nas expressões (por exemplo, `clamp`)

A lista de funções aparece *em três lugares* da gramática: em `repository.expressao`, em `repository.valor_opcao` e dentro do `${…}` de `repository.assembly`. Mude os três e acrescente um caso no teste de expressões.

=== Um registrador ou palavra de assembly

Edite a regra de registradores (ou a de `offset`, `ptr`…) em `repository.assembly`. Cuidado com nomes comuns: tudo o que entrar ali fica colorido como registrador em *todas* as arquiteturas.

=== Mudar uma cor

A gramática não define cores (capítulo 4). Para mudar a cor de algo *no seu editor*, use `editor.tokenColorCustomizations` nas configurações do VS Code:

```json
"editor.tokenColorCustomizations": {
  "textMateRules": [{
    "scope": "keyword.operator.endianness.txt2bin",
    "settings": { "foreground": "#FF8C42", "fontStyle": "bold" }
  }]
}
```

Para mudar *para todos os usuários*, troque o escopo na gramática por outro que os temas já colorem do jeito desejado.

=== Uma configuração nova

+ Declare em `contributes.configuration.properties` no `package.json`, com tipo, padrão e descrição.
+ Leia com `cfg().get('nome', padrao)` no ponto em que for usada.
+ Se um teste depender dela, acrescente em `registro.config` no `vscode-falso.ts`.

=== Um comando novo

+ Declare em `contributes.commands` e, se quiser um botão, em `menus`.
+ Registre com `vscode.commands.registerCommand('txt2bin.x', …)` dentro de `activate`.
+ Teste chamando `registro.comandos['txt2bin.x']()` e atualize o teste "registros".

=== Um recurso novo do editor (por exemplo, autocompletar rótulos)

Siga o modelo dos provedores que já existem: `vscode.languages.registerXxxProvider(sel, { provideXxx(doc, pos) { … } })`. Para autocompletar rótulos, seria `registerCompletionItemProvider` com o cifrão como caractere de disparo, listando os rótulos de `resultados.get(uri).rotulos`. Acrescente o registro correspondente no `vscode-falso.ts`.

== Dívidas técnicas

- *Regras copiadas.* As regras de expressão aparecem em três lugares, porque cada cópia precisa de uma variação (sem comentários, sem nomes inválidos) e TextMate não tem herança. É herança do script gerador que não foi guardado (capítulo 2).
- *Grupos vazios.* As regras 2, 4 e 5 têm um grupo de captura vazio `()` onde as outras têm `(\\+)?`. É outro resto do gerador: inofensivo, mas confunde quem lê.
- *Assembly heurístico.* Uma só gramática para todas as arquiteturas.
- *Sem source maps* no build, o que impede pontos de parada.

== Limitações

- *A extensão nunca foi testada à mão num VS Code real* antes do primeiro `.vsix`. Vale uma rodada com F5 antes de publicar.
- *Um erro por vez*, porque o conversor para no primeiro.
- *Erros sem coluna*: o sublinhado ocupa a linha inteira.
- *A validação ao digitar chama o `llvm-mc`* nas seções de assembly. Há cache por conteúdo, mas em arquivos grandes é melhor usar `txt2bin.validacao` igual a `aoSalvar`.
- *Um `txt2bin.config.json` malformado é ignorado em silêncio* na extensão; no CLI, dá erro.
- *Não há autocompletar* de rótulos, diretivas ou arquiteturas, além dos snippets.

== Publicação

Antes de publicar, há decisões que são do Higor e campos a preencher no `package.json`:

#table(
  columns: (auto, 1fr),
  table.header[campo][situação],
  [`publisher`], [ainda é o marcador `seu-publisher`],
  [`license`], [`UNLICENSED`; falta escolher a licença e criar o arquivo `LICENSE` (aí o `--skip-license` sai do script)],
  [`repository`], [falta a URL do repositório público (aí o `--allow-missing-repository` sai)],
  [`icon`], [opcional: um PNG de 128 × 128],
)

Há dois registros:

- *VS Code Marketplace*, da Microsoft: crie um publicador em `marketplace.visualstudio.com/manage`, um token de acesso no Azure DevOps com o escopo "Marketplace → Manage", e rode `bunx vsce login <publisher>` e `bunx vsce publish`.
- *Open VSX*, o registro usado pelo VSCodium, pelo Cursor e por outros editores derivados: crie uma conta em `open-vsx.org` e rode `bunx ovsx publish` com o `.vsix` e o token.

#nota[
  Os processos de publicação mudam com o tempo. Confira a documentação oficial de cada registro antes de publicar.
]

== Ideias para o futuro

- Autocompletar rótulos, nomes de diretivas e de arquiteturas.
- Coluna nos erros, o que exigiria o conversor informar a coluna.
- Vários erros por análise.
- Hover sobre bytes hex mostrando o offset de cada byte.
- `<<utf8 json` para colorir o JSON embutido.
- Gerar o `.vsix` e publicar via integração contínua.
- Reaproveitar a gramática no GitHub e no Shiki, para que os `.ttb` fiquem coloridos no GitHub e em sites de documentação.
