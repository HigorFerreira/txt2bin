# txt2bin para VS Code

Suporte aos arquivos `.ttb` do txt2bin, o formato de texto para escrever arquivos binários.

- **Realce de sintaxe**: diretivas, rótulos, texto e escapes, bytes hex, base64, expressões (números, operadores, funções, `$rótulos`) e assembly (mnemônicos, registradores, rótulos, comentários `;` `#` `//` `@`, e `${...}` destacado como expressão).
- **Erros enquanto você digita**, na linha certa, inclusive os do montador de assembly.
- **Offset e tamanho** de cada seção no fim da linha `<<diretiva`.
- **Passar o mouse** sobre um `$rótulo` mostra o valor (decimal e hex); sobre uma diretiva, o offset, o tamanho e, no assembly, os bytes gerados.
- **F12 / Ctrl+clique** num `$rótulo` vai até o `<<@rótulo`.
- **Estrutura** (Outline e breadcrumbs) com as seções e rótulos.
- **Comandos**: *txt2bin: Gerar arquivo binário* (também no botão do título do editor), *Mostrar mapa de seções* e *Mostrar dump hexadecimal*.
- **Snippets**: `glb`, `bloco`, `asm`, `boot`, `@`, `#`.

## Instalar

```sh
code --install-extension txt2bin-vscode-0.3.0.vsix
```

Ou, no VS Code: *Extensões* → menu `…` → *Instalar do VSIX…*.

Para as seções `<<assembly(...)` é preciso ter o LLVM (`llvm-mc` e `ld.lld`) instalado. A extensão também lê o `txt2bin.config.json` da pasta do arquivo.

## Configurações

| configuração | padrão | |
|---|---|---|
| `txt2bin.validacao` | `aoDigitar` | `aoDigitar`, `aoSalvar` ou `desligada` |
| `txt2bin.atraso` | `400` | ms de espera depois de parar de digitar |
| `txt2bin.mostrarOffsets` | `true` | mostra offset e tamanho ao fim dos cabeçalhos |

## Desenvolver

```sh
bun install
bun run build       # dist/extension.js (inclui o conversor)
bun run package     # gera o .vsix
```

Para testar sem instalar, abra esta pasta no VS Code e aperte F5.
