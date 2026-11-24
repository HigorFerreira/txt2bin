#import "../estilo.typ": *

= A parte que roda: `extension.ts`

Este capítulo percorre `editores/vscode/src/extension.ts`, um arquivo de 200 linhas. Ele não sabe nada de binários: tudo o que ele mostra vem do conversor. O trabalho dele é *perguntar ao conversor e traduzir a resposta para a linguagem do editor*.

== Ciclo de vida

O VS Code carrega `dist/extension.js` no Extension Host e chama a função exportada `activate(ctx)` *uma vez*, quando a extensão é ativada (capítulo 3). Tudo o que ela registra (ouvintes de eventos, provedores, comandos) vai para `ctx.subscriptions`. Quando a extensão é desligada, o VS Code chama `dispose()` em cada item dessa lista e depois `deactivate()`, que aqui não faz nada, porque não há mais nada para fechar.

```ts
export function activate(ctx: vscode.ExtensionContext) {
  diagnosticos = vscode.languages.createDiagnosticCollection('txt2bin');
  saida = vscode.window.createOutputChannel('txt2bin');
  ctx.subscriptions.push(diagnosticos, saida, /* ouvintes, provedores, comandos */);
  vscode.workspace.textDocuments.forEach(d => agendar(d, 0));
}
```

A última linha analisa os documentos que já estavam abertos antes de a extensão acordar.

== Reaproveitando o conversor

```ts
import { ehErroFonte, formatar, mapa, montar, FORMATOS,
         type Config, type Formato, type Resultado } from '../../../src/index.ts';
```

A extensão importa *o próprio código do txt2bin*, três pastas acima. Não existe uma segunda implementação. O build (capítulo 7) copia esse código para dentro de `dist/extension.js`. Consequências:

- erros, offsets e valores mostrados no editor são *exatamente* os da linha de comando;
- qualquer mudança no conversor aparece na extensão no próximo build.

== O estado guardado

```ts
const resultados = new Map<string, Resultado>();  // último resultado válido
let diagnosticos: vscode.DiagnosticCollection;     // os sublinhados
let saida: vscode.OutputChannel;                   // o painel "Saída → txt2bin"
const mudouHints = new vscode.EventEmitter<void>(); // avisa que os offsets mudaram
```

O mapa `resultados` guarda o último resultado *sem erro* de cada arquivo, indexado pela URI. Enquanto você digita e o arquivo fica momentaneamente inválido, o hover e os offsets continuam mostrando os valores da última versão boa, em vez de sumir e voltar a cada tecla.

== Analisar só quando você para de digitar

Quatro ouvintes decidem *quando* analisar:

#table(
  columns: (auto, 1fr),
  table.header[evento][ação],
  [abriu um documento], [analisa já, se a validação não estiver desligada],
  [mudou o texto], [agenda uma análise para daqui a `atraso` ms, se a validação for `aoDigitar`],
  [salvou], [analisa já, se a validação não estiver desligada],
  [fechou], [apaga os sublinhados e o resultado guardado],
)

Cada tecla gera um evento de mudança. Converter a cada tecla seria desperdício, principalmente com assembly, que chama o `llvm-mc` num processo externo. Então a função `agendar` faz um _debounce_: cancela o temporizador anterior daquele documento e marca um novo.

```ts
function agendar(doc, atraso) {
  if (doc.languageId !== 'txt2bin') return;   // ignora arquivos que não são .ttb
  const k = doc.uri.toString();
  clearTimeout(temporizadores.get(k));
  temporizadores.set(k, setTimeout(() => analisar(doc), atraso));
}
```

Se você digita cinco teclas em sequência rápida, quatro temporizadores são cancelados antes de disparar, e só o último roda, 400 ms depois da última tecla.

#nota[
  A configuração é lida a cada evento (`cfg().get('validacao')`), e não guardada numa variável. Por isso mudar uma configuração vale na hora, sem recarregar a janela.
]

== A viagem de um erro

A função central é `analisar`:

```ts
function analisar(doc) {
  try {
    const r = montar(doc.getText(), { config: lerConfig(doc) });
    resultados.set(doc.uri.toString(), r);
    diagnosticos.set(doc.uri, []);       // sem erros: limpa os sublinhados
    mudouHints.fire();                   // offsets mudaram: redesenhar
    return r;
  } catch (e) {
    const linha = ehErroFonte(e)
      ? Math.min(Math.max(e.linha - 1, 0), doc.lineCount - 1)
      : 0;
    const texto = doc.lineAt(linha);
    const intervalo = new vscode.Range(
      linha, texto.firstNonWhitespaceCharacterIndex,
      linha, texto.text.length);
    const d = new vscode.Diagnostic(
      intervalo, e.message, vscode.DiagnosticSeverity.Error);
    d.source = 'txt2bin';
    diagnosticos.set(doc.uri, [d]);
  }
}
```

Vamos seguir um erro de verdade. Num arquivo com três linhas, você digita um parêntese sem fechar na linha 3 e para de digitar:

```text
1  <<uint8
2  1
3  (2 +
```

#fluxo-vertical[
  você para de digitar → evento de mudança → `agendar(doc, 400)`
][
  400 ms depois: `analisar` chama `montar` com o texto do arquivo
][
  o conversor lança `ErroFonte(3, '"(" sem ")" correspondente')`
][
  o `catch` converte a linha: 3 − 1 = 2 (o VS Code conta a partir de 0)
][
  um `Diagnostic` cobre a linha 2, do primeiro caractere visível ao fim
][
  linha sublinhada em vermelho, mensagem no hover e no painel Problemas
]

A mensagem é a mesma da linha de comando, que mostra:

```text
erro: err.ttb:3: "(" sem ")" correspondente
```

Detalhes que importam:

- *`e.linha - 1`*: o conversor conta linhas a partir de 1, como as pessoas; o VS Code, a partir de 0.
- *`Math.min`/`Math.max`*: protege contra uma linha fora do documento, que faria o VS Code lançar um erro.
- *O sublinhado cobre a linha inteira*, porque o conversor informa a linha, mas não a coluna.
- *Só aparece um erro por vez*, porque o conversor para no primeiro. Corrigido esse, o próximo aparece.
- Um erro que não seja do arquivo-fonte (um bug no conversor) vai para a linha 1, para pelo menos aparecer.
- `lerConfig` procura um `txt2bin.config.json` na pasta do arquivo, como faz o CLI. Se o JSON estiver malformado, é ignorado em silêncio.

#bastidores[
  *Por que `ehErroFonte(e)` e não `e instanceof ErroFonte`?* Durante a conversa, ao empacotar o conversor para Node, o `bun build` chegou a duplicar módulos. Com duas cópias da classe `ErroFonte`, o erro lançado por uma cópia não era `instanceof` da outra. Na extensão, isso mandaria todos os erros para a linha 1. A solução foi testar pela forma: `ehErroFonte` confere se `name` é `'ErroFonte'` e se `linha` é um número. A regra ficou registrada no `CONTEXTO.md`: *use sempre `ehErroFonte`, nunca `instanceof`.*
]

== Offsets no fim da linha (_inlay hints_)

_Inlay hints_ são os textos em cinza que o editor desenha dentro do código sem que eles façam parte do arquivo, como os nomes de parâmetros em TypeScript. A extensão põe um no fim de cada cabeçalho. No `midi.ttb`, o editor mostra:

#table(
  columns: (auto, auto, auto, 1fr),
  table.header[linha][cabeçalho][dica][significado],
  [9], [`<<utf8`], [`0x0 · 4 B`], [`MThd` ocupa os bytes 0 a 3],
  [11], [`<<uint32+`], [`0x4 · 4 B`], [o tamanho do cabeçalho],
  [13], [`<<uint16+`], [`0x8 · 6 B`], [três números de 16 bits],
  [19], [`<<utf8`], [`0xE · 4 B`], [`MTrk`],
  [21], [`<<uint32+`], [`0x12 · 4 B`], [o `$fim-$ini`, que vale 40],
  [23], [`<<@ini`], [`= 0x16`], [o rótulo vale 22],
  [26], [`<<hex`], [`0x16 · 31 B`], [os eventos de nota],
  [38], [`<<uint8`], [`0x35 · 2 B`], [o tempo em VLQ],
  [40], [`<<hex`], [`0x37 · 7 B`], [os últimos eventos],
  [43], [`<<@fim`], [`= 0x3E`], [o rótulo vale 62, o tamanho total],
)

O código:

```ts
vscode.languages.registerInlayHintsProvider(sel, {
  onDidChangeInlayHints: mudouHints.event,
  provideInlayHints(doc, faixa) {
    // para cada seção visível (menos comentários), uma dica no fim do cabeçalho
  },
});
```

- O VS Code pede as dicas só para a *faixa visível* da tela; seções fora dela são puladas.
- O VS Code não sabe sozinho que os offsets mudaram depois de uma análise. O evento `onDidChangeInlayHints` é como a extensão avisa "peça de novo", e por isso `analisar` chama `mudouHints.fire()`.
- A configuração `txt2bin.mostrarOffsets` desliga tudo.

== Passar o mouse (_hover_)

O VS Code chama `provideHover` quando o mouse para sobre um ponto. A função:

+ pega o último resultado válido. Se não houver nenhum, não mostra nada;
+ verifica se o mouse está sobre um rótulo com cifrão. Se estiver, mostra o valor dele em decimal e em hexadecimal. Sobre `$fim`: *\$fim = `62` · `0x3E`*;
+ senão, procura a seção cujo cabeçalho está naquela linha e mostra cabeçalho, offset, tamanho e onde termina. Sobre a linha 26: *`<<hex`*, offset `22` · `0x16`, tamanho `31` byte(s), termina em `0x35`. Num bloco de assembly com até 64 bytes, mostra também os bytes gerados.

== Ir para a definição (F12)

Se o cursor está sobre um rótulo, a função `linhaDoRotulo` procura a linha `<<@nome` correspondente, e o VS Code pula até lá com F12 ou Ctrl+clique. É uma busca textual simples, que *funciona mesmo com o arquivo inválido*, porque não depende do conversor.

== Outline e breadcrumbs

O provedor de símbolos também é textual. Ele percorre as linhas e:

- transforma cada `<<diretiva` num símbolo do tipo "campo", com o resto do cabeçalho como detalhe;
- transforma cada `<<@rótulo` num símbolo do tipo "chave";
- deixa de fora os comentários `<<#`;
- estende o intervalo de cada seção até a linha antes da próxima diretiva, para que o breadcrumb saiba em que seção o cursor está.

No `midi.ttb`, o Outline mostra: `utf8`, `uint32+`, `uint16+`, `utf8`, `uint32+`, `ini`, `hex`, `uint8`, `hex`, `fim`.

== Os comandos

#table(
  columns: (auto, 1fr),
  table.header[comando][o que faz],
  [*Gerar arquivo binário* (`txt2bin.gerar`)], [Analisa. Se houver erro, avisa "corrija os erros antes de gerar" e para. Senão, pergunta o formato, sugere um nome, abre a janela de salvar e grava. É também o botão na barra de título.],
  [*Mostrar mapa de seções* (`txt2bin.mapa`)], [Escreve no painel Saída a mesma tabela que o `--map` da linha de comando.],
  [*Mostrar dump hexadecimal* (`txt2bin.hex`)], [Escreve no painel Saída um dump com offset, 16 bytes por linha e a coluna ASCII.],
)

O nome sugerido pelo comando de gerar troca o `.ttb` por uma terminação conforme o formato:

#table(
  columns: 6,
  table.header[`bin`][`hex`][`base64`][`base64url`][`datauri`][`ihex`],
  [`.bin`], [`.hex.txt`], [`.b64`], [`.b64`], [`.datauri.txt`], [`.hex`],
)

O `ihex` (Intel HEX) fica com `.hex` porque é o que o `avrdude` e as ferramentas de Arduino esperam; o dump hexadecimal comum fica com `.hex.txt` para não ser confundido com ele.

O dump do `midi.ttb` começa assim:

```text
00000000  4d 54 68 64 00 00 00 06 00 00 00 01 00 60 4d 54  MThd.........`MT
00000010  72 6b 00 00 00 28 00 c0 00 00 90 3c 64 60 80 3c  rk...(.....<d`.<
```

O `00 00 00 28` no segundo bloco é o `$fim-$ini` da linha 22: 40 bytes, em big-endian.
