#import "../estilo.typ": *

= Testes sem abrir o VS Code

A extensão foi feita sem nunca ser aberta num VS Code de verdade. Como, então, saber que ela funciona? Com dois truques: usar *o mesmo motor de cores* que o VS Code usa, e *imitar a API* do VS Code. Os 25 testes rodam com `bun test` dentro de `editores/vscode/`, em menos de um segundo.

#nota[
  O `bunfig.toml` da raiz do repositório limita o `bun test` da raiz à pasta `test/` de lá. Assim os 47 testes do conversor e os 25 da extensão não se misturam: cada conjunto roda na sua pasta.
]

== Testando as cores com o motor de verdade

O realce do VS Code é feito por duas bibliotecas que a Microsoft publica separadamente:

- `vscode-oniguruma`: o motor de expressões regulares Oniguruma, compilado para WebAssembly;
- `vscode-textmate`: a implementação das regras TextMate (pilha de estados, `begin`/`end`, capturas, `include`).

O arquivo `test/gramatica.ts` carrega a gramática com elas e tokeniza um texto linha por linha, como o editor faria:

```ts
await oniguruma.loadWASM(wasm);                     // liga o motor de regex
const registro = new vsctm.Registry({
  onigLib, loadGrammar: async () => parseRawGrammar(json),
});
const gramatica = await registro.loadGrammar('source.txt2bin');

let estado = vsctm.INITIAL;                          // a pilha começa vazia
for (const linha of fonte.split('\n')) {
  const r = gramatica.tokenizeLine(linha, estado);   // tokens da linha
  estado = r.ruleStack;                              // passa para a próxima linha
}
```

Repare no `ruleStack` passando de uma linha para a outra: é a pilha do capítulo 4, agora visível no código.

Os 17 testes de `test/gramatica.test.ts` usam uma função auxiliar, `escopo(fonte, trecho)`, que devolve o escopo de um trecho:

```ts
test('cabeçalho, nome e "+"', async () => {
  const f = '<<uint32+\n1\n';
  expect(await escopo(f, '<<')).toBe('punctuation.definition.directive');
  expect(await escopo(f, 'uint32')).toBe('keyword.control.directive');
  expect(await escopo(f, '+')).toBe('keyword.operator.endianness');
});
```

Eles se dividem em quatro grupos:

#table(
  columns: (auto, 1fr),
  table.header[grupo][o que verifica],
  [diretivas], [o `<<`, o nome, o `+`, rótulos, comentários de seção, diretivas desconhecidas, texto antes da primeira diretiva],
  [conteúdo], [texto e escapes, hex, base64, expressões (funções, constantes, rótulos, números, caracteres, operadores, nomes inválidos), `fill`],
  [assembly], [arquitetura, opções, rótulo, mnemônico, registrador, número, comentários, `${…}` e o `#5` do ARM não virar comentário],
  [exemplos], [*nenhum* dos `.ttb` de `exemplos/` pode ter um único trecho marcado como `invalid`],
)

O último grupo é o mais valioso. Ele pega regressões amplas: se uma mudança na gramática quebra algo real, algum exemplo acende em vermelho e o teste falha.

== Testando a lógica com um VS Code de mentira

O problema: `extension.ts` começa com `import * as vscode from 'vscode'`, e esse módulo só existe dentro do VS Code.

A solução é o arquivo `test/vscode-falso.ts`, uma imitação com só o que a extensão usa: `Position`, `Range`, `Diagnostic`, `Hover`, `InlayHint`, `DocumentSymbol`, `EventEmitter`, `window`, `workspace`, `languages`, `commands`… As funções de registro não registram nada no editor; só guardam o que recebem num objeto `registro`:

```ts
registerHoverProvider: (_, p) => (registro.provedores.hover = p),
registerCommand: (nome, f) => (registro.comandos[nome] = f),
```

Também há uma função `documento(caminho, texto)` que cria um documento falso, com `getText`, `lineAt`, `getWordRangeAtPosition` e o que mais a extensão chama.

Em `test/extensao.test.ts`, a imitação é posta no lugar do módulo de verdade *antes* de importar a extensão:

```ts
mock.module('vscode', () => falso);                // agora 'vscode' é a imitação
const ext = await import('../src/extension.ts');   // importa DEPOIS do mock
ext.activate({ subscriptions: { push() {} } });
```

`mock.module` é do `bun:test`: troca um módulo por outro para todos os `import` seguintes. Depois disso, os testes chamam os provedores guardados exatamente como o VS Code chamaria:

#table(
  columns: (auto, 1fr),
  table.header[teste][verifica],
  [registros], [os 4 provedores e os 3 comandos foram registrados],
  [arquivo válido], [nenhum diagnóstico; o mapa diz "total: 62 bytes"],
  [erro], [`(2 +` na linha 3 vira um diagnóstico na linha 2 (contando de 0), com a mensagem certa],
  [inlay hints], [`0x4 · 4 B` na linha 11 e `= 0x16` na linha 23 do `midi.ttb`],
  [hover], [`$fim` vale 62 (`0x3E`); o cabeçalho mostra "offset 18"],
  [F12], [`$ini` leva à linha do `<<@ini`],
  [outline], [a lista exata de seções e rótulos, sem comentários],
  [dump hex], [começa com `00000000  4d 54 68 64` (`MThd`)],
)

#cuidado[
  O que esses testes *não* cobrem: a aparência real no editor, os temporizadores de verdade (os testes chamam um comando, que analisa na hora), a janela de salvar do comando de gerar e a integração com um VS Code real. Para isso, só o F5 (capítulo 7) ou o `.vsix` instalado.
]

== A prévia colorida

`bun run previa` gera um `previa.html` com os exemplos coloridos nas cores aproximadas do tema Dark+. Passando o mouse sobre um trecho, aparece o escopo dele. Serve para conferir uma mudança na gramática com os olhos, sem instalar nada.

As cores estão numa tabela feita à mão em `scripts/previa.ts`, então podem diferir do tema real em detalhes. Por exemplo, o Dark+ não dá uma cor própria ao `+` de big-endian, mas a prévia o pinta de laranja para ele aparecer.
