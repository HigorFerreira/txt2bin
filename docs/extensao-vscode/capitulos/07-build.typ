#import "../estilo.typ": *

= Do código ao pacote instalável

O VS Code não executa TypeScript, e o conversor está fora da pasta da extensão. Este capítulo mostra como os dois viram um único arquivo JavaScript e, depois, um pacote `.vsix`.

#fluxo[`src/extension.ts` + conversor em `../../../src`][`build.ts`][`dist/extension.js`][`vsce package`][`.vsix`]

== `build.ts`

```ts
await Bun.build({
  entrypoints: ['src/extension.ts'], outdir: 'dist',
  target: 'node', format: 'cjs', external: ['vscode'], minify: false,
});
```

#table(
  columns: (auto, 1fr),
  table.header[opção][por quê],
  [`entrypoints`], [o ponto de partida. O Bun segue todos os `import`, inclusive o conversor três pastas acima, e junta tudo.],
  [`target: 'node'`], [o Extension Host roda Node, não Bun nem navegador.],
  [`format: 'cjs'`], [o VS Code carrega extensões com `require`, o formato CommonJS.],
  [`external: ['vscode']`], [o módulo `vscode` não existe no disco: o VS Code o injeta quando carrega a extensão. Ele precisa continuar como `require('vscode')`, sem ser embutido.],
  [`minify: false`], [facilita depurar. O arquivo tem cerca de 50 KB e não precisa encolher.],
)

== `tsconfig.json`

Serve só para checar tipos (`noEmit`): quem gera JavaScript é o Bun. A opção `allowImportingTsExtensions` permite os `import … from './x.ts'` do conversor, e `types` traz os tipos de Node e do Bun. As pastas `src`, `test` e `scripts` são checadas.

== `.vscodeignore`

Funciona como um `.gitignore` para o pacote: o que estiver listado não entra no `.vsix`.

```text
node_modules/**  src/**  build.ts  tsconfig.json  bun.lock  .vscode/**
test/**  scripts/**  previa.html
```

O código-fonte fica de fora porque já está todo dentro de `dist/extension.js`. O pacote final tem 8 arquivos e cerca de 22 KB: o manifesto, o README, a configuração de linguagem, os snippets, a gramática e o `dist/extension.js`.

#nota[
  Um `.vsix` é um arquivo ZIP com outro nome. Dá para abrir com qualquer descompactador e ver exatamente o que vai ser instalado.
]

== `vsce package`

O `vsce` é a ferramenta oficial da Microsoft para empacotar e publicar extensões. O script `bun run package` faz, em ordem: checagem de tipos, testes, build e, só se tudo passar, o empacotamento:

```text
vsce package --no-dependencies --skip-license --allow-missing-repository
```

#table(
  columns: (auto, 1fr),
  table.header[opção][por quê],
  [`--no-dependencies`], [não há dependências de execução: está tudo no `dist/extension.js`.],
  [`--skip-license`], [ainda não há licença (uma decisão pendente do Higor).],
  [`--allow-missing-repository`], [ainda não há repositório público.],
)

O `vsce` também confere o README: links relativos para fora da pasta, como `../../README.md`, quebram no Marketplace e fazem o empacotamento falhar quando não há repositório configurado. Por isso o README da extensão não tem links para fora de `editores/vscode/`.

== Instalar e desenvolver

*Instalar o `.vsix`* no seu VS Code:

```sh
code --install-extension txt2bin-vscode-0.1.0.vsix
```

Ou, no VS Code: Extensões, menu "…", "Instalar do VSIX…". Para atualizar, gere um novo `.vsix` e instale por cima.

*Desenvolver com F5.* Abra a pasta `editores/vscode/` no VS Code e aperte F5. O `launch.json` roda primeiro a tarefa de build e depois abre uma *segunda janela* do VS Code, o _Extension Development Host_, com a extensão carregada direto da pasta e a pasta `exemplos/` aberta.

```json
{ "type": "extensionHost", "request": "launch",
  "args": ["--extensionDevelopmentPath=${workspaceFolder}",
           "${workspaceFolder}/../../exemplos"],
  "preLaunchTask": "${defaultBuildTask}" }
```

Na janela de desenvolvimento:

#table(
  columns: (auto, 1fr),
  table.header[mudou…][faça],
  [gramática, configuração de linguagem ou snippets], [paleta → _Developer: Reload Window_. Não precisa de build.],
  [`extension.ts` ou o conversor], [`bun run build` e recarregue a janela.],
)

- `console.log` da extensão aparece no _Console de Depuração_ da janela original.
- _Developer: Show Running Extensions_ mostra se a extensão foi ativada e quanto tempo levou.
- Pontos de parada em `extension.ts` exigem _source maps_, que o build hoje não gera. Para isso, acrescente `sourcemap: 'external'` no `build.ts`.

#cuidado[
  As seções `<<assembly` dependem do `llvm-mc` e do `ld.lld`, que normalmente não vêm com as ferramentas do Xcode no macOS. Sem eles, a extensão funciona, mas cada seção de assembly vira um erro sublinhado com a dica de instalação (no macOS, `brew install llvm lld`).
]
