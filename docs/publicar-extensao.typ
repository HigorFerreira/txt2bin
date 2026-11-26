// Roteiro para publicar a extensão do txt2bin no Marketplace do VS Code e no Open VSX.
// Compilar (na raiz do repositório):
//	 typst compile docs/publicar-extensao.typ docs/publicar-extensao.pdf

#import "extensao-vscode/estilo.typ": *

#show: documento.with(
	titulo: "Publicar a extensão txt2bin",
	subtitulo: "Marketplace do VS Code e Open VSX, passo a passo",
	autor: "Higor · txt2bin",
	data: "extensão 0.2.1 · novembro de 2026",
)

= Visão geral

Hoje a extensão só existe como um arquivo `.vsix` que se instala à mão. Publicar é colocá-la nas lojas, para que qualquer pessoa a encontre buscando "txt2bin" no painel de extensões. Há *duas lojas*:

#table(
	columns: (auto, 1fr, auto),
	table.header[loja][quem usa][conta],
	[Visual Studio Marketplace], [o VS Code da Microsoft], [conta Microsoft],
	[Open VSX], [VSCodium, Cursor, Gitpod, Eclipse Theia e outros editores derivados], [conta GitHub + Eclipse],
)

As duas recebem *o mesmo arquivo `.vsix`*. O trabalho é: preparar a extensão uma vez, gerar o `.vsix` e enviá-lo para cada loja.

#fluxo[preparar a extensão][`bun run package`][`.vsix`][Marketplace][Open VSX]

#cuidado[
	*A rede do trabalho pode bloquear tudo isto.* Redes corporativas costumam barrar o login em contas Microsoft pessoais, o portal do Marketplace ou o envio de arquivos. Faça os passos de conta e de envio *de casa ou pelo roteador do celular*. Gerar o `.vsix` funciona em qualquer rede.
]

== Os três jeitos de enviar

#table(
	columns: (auto, 1fr, auto),
	table.header[jeito][como][quando usar],
	[*envio manual*], [subir o `.vsix` pelo site do Marketplace], [primeira publicação; atualizações esporádicas],
	[*Trusted Publishing*], [o GitHub Actions publica sozinho, sem token guardado], [quando houver CI; é o caminho que a Microsoft recomenda agora],
	[*token (PAT)*], [`vsce login` + `vsce publish` no terminal], [evitar: ver a seção sobre tokens],
)

#nota[
	*Recomendação:* a primeira publicação por envio manual, que não exige nenhum token. Automatizar fica para quando o CI do roadmap existir.
]

= Preparar a extensão

Tudo nesta parte acontece dentro de `editores/vscode/` e não precisa de internet.

== O `publisher`

Todo item do Marketplace pertence a um *publisher*, que é a "conta de editora". O identificador da extensão é `<publisher>.<name>`, por exemplo:

```text
higorferreira.txt2bin-vscode
```

Hoje o `package.json` tem o marcador `"publisher": "seu-publisher"`. Ele precisa ser trocado *pelo ID exato* do publisher criado no capítulo seguinte; se não bater, o Marketplace recusa o arquivo.

#cuidado[
	*O ID do publisher não pode ser mudado depois de criado.* Ele aparece nas URLs e no identificador da extensão para sempre. Escolha algo curto e estável: `higorferreira`, `hfashigor`, `txt2bin`… O *nome de exibição* (display name) pode ser mudado à vontade.
]

Use o mesmo ID nas duas lojas: no Open VSX ele vira o *namespace*.

== O ícone

O Marketplace mostra um ícone na busca e na página. Regras do `vsce`:

- formato *PNG* (SVG não é aceito no ícone);
- *pelo menos 128 × 128 pixels* (256 × 256 fica bom em telas de alta densidade);
- declarado no `package.json`:

```json
"icon": "icone.png"
```

*Já feito:* na loja, a letra T se desfazendo em pixels (texto que vira binário); nos arquivos `.ttb`, o `<<` que abre cada seção, em ciano, com uma versão para tema escuro e outra para tema claro. Tudo é desenhado em Typst em `editores/vscode/icones/icone.typ` e já está ligado no `package.json` (`icon` e `contributes.languages[].icon`); o `.typ` fica fora do pacote pelo `.vscodeignore`. Para regenerar:

```sh
cd editores/vscode/icones
typst compile --format png --ppi 144 icone.typ icone.png
typst compile --format svg --input variante=arquivo icone.typ arquivo-ttb.svg
typst compile --format svg --input variante=arquivo-claro icone.typ arquivo-ttb-claro.svg
```

== A licença

O `vsce` procura um arquivo `LICENSE` *dentro* de `editores/vscode/`, mas o arquivo está na raiz do repositório. Por isso o script `package` usa hoje `--skip-license`. Para a loja mostrar a licença:

```sh
cp LICENSE editores/vscode/LICENSE			# na raiz do repositório
```

E então tirar `--skip-license` do script `package`.

== O script `package`

Hoje:

```text
vsce package --no-dependencies --skip-license --allow-missing-repository
```

Depois da licença copiada e com o `repository` já preenchido no `package.json`, fica só:

```text
vsce package --no-dependencies
```

O `--no-dependencies` continua: a extensão não tem dependências de execução (o conversor vai embutido no `dist/extension.js`).

== Textos da página

A página da extensão no Marketplace é montada assim:

#table(
	columns: (auto, 1fr),
	table.header[campo][de onde vem],
	[título], [`displayName` (hoje `txt2bin`)],
	[frase curta], [`description` (hoje em português)],
	[página principal], [`README.md` da pasta `editores/vscode/`],
	[aba "Changelog"], [`CHANGELOG.md` da pasta, se existir],
	[busca], [`keywords` e `categories`],
)

A loja é mundial; vale escrever a `description` e o README da extensão *em inglês* (ou bilíngues), como foi feito com o README principal. Sugestão de `description`:

```text
Syntax highlighting, live errors and byte offsets for txt2bin (.ttb) files
```

#cuidado[
	*Imagens no README precisam de `https`.* O `vsce` recusa imagens por `http` ou por caminho relativo sem `repository`. *Links relativos* (como `exemplos/midi.ttb`) são reescritos para apontar ao GitHub, usando o `repository` e o ramo `main`. Links para fora da pasta (`../../README.md`) quebram: use a URL completa do GitHub.
]

Um `CHANGELOG.md` em `editores/vscode/` com as versões 0.1.0, 0.2.0 e 0.2.1 alimenta a aba de mudanças.

== Versão

Cada envio exige uma versão *nova*: o Marketplace recusa repetir um número já publicado. A estreia pode sair como 0.2.1 ou como 0.3.0, para marcar a chegada à loja. A partir daí, a cada atualização:

```sh
cd editores/vscode
# edite "version" no package.json (ex.: 0.3.0 → 0.3.1) e o CHANGELOG.md
bun run package
```

== Gerar e conferir o `.vsix`

```sh
cd editores/vscode
bun run package											# typecheck, testes, build e empacotamento
unzip -l txt2bin-vscode-*.vsix			 # o .vsix é um ZIP: veja o que vai dentro
code --install-extension txt2bin-vscode-*.vsix	 # teste local antes de enviar
```

Deve conter o `package.json`, o README, o CHANGELOG, a LICENSE, o ícone, a gramática, a configuração de linguagem, os snippets e o `dist/extension.js`, e nada de `src/`, `test/` ou `node_modules/`.

#nota[
	O `.vsix` não é versionado (`editores/vscode/*.vsix` está no `.gitignore`). Gere de novo a cada publicação.
]

= Marketplace do VS Code

== Criar o publisher (uma vez)

+ Abra #link("https://marketplace.visualstudio.com/manage") e entre com uma *conta Microsoft* (pode ser pessoal: Outlook, Hotmail ou qualquer e-mail cadastrado como conta Microsoft).
+ Clique em *Create publisher*.
+ Preencha:
	- *Name*: o nome exibido (ex.: `Higor Ferreira`);
	- *ID*: o identificador permanente (ex.: `higorferreira`);
	- os demais campos (site, logo, redes) são opcionais.
+ Salve. Confira que o ID é *exatamente* o que está no `publisher` do `package.json`.

== Primeira publicação: envio manual

+ Gere o `.vsix` (seção anterior).
+ Na página do publisher em #link("https://marketplace.visualstudio.com/manage"), clique em *New extension* → *Visual Studio Code*.
+ Arraste o `txt2bin-vscode-X.Y.Z.vsix` e confirme.
+ O Marketplace faz uma *verificação automática* (alguns minutos). Enquanto isso, a extensão aparece como "Verifying".
+ Quando terminar, ela fica pública em:
	```text
	https://marketplace.visualstudio.com/items?itemName=<publisher>.txt2bin-vscode
	```
+ No VS Code, a busca por "txt2bin" no painel de extensões pode demorar mais alguns minutos para mostrar.

== Atualizações

Na mesma página de gerenciamento, no menu "…" ao lado da extensão, escolha *Update* e envie o novo `.vsix` (com versão maior). Quem já tem a extensão instalada recebe a atualização sozinho.

== Despublicar

No mesmo menu há *Unpublish* (esconde a extensão da loja, pode voltar) e *Remove* (apaga). Não é possível reaproveitar um número de versão já usado, nem depois de remover.

= Publicar automaticamente com o GitHub Actions

Quando houver CI, o caminho que a Microsoft recomenda é o *Trusted Publishing*: o publisher passa a *confiar* em um workflow específico de um repositório específico. O GitHub Actions prova quem é com um token temporário (OIDC), e nenhum segredo fica guardado no repositório.

== Configurar a confiança no Marketplace

Na página do publisher, abra *Trusted Publishing* e cadastre:

#table(
	columns: (auto, 1fr),
	table.header[campo][valor],
	[repositório], [`HigorFerreira/txt2bin`],
	[workflow], [`.github/workflows/publicar-extensao.yml`],
	[ambiente], [opcional; deixe vazio no começo],
)

== O workflow

Esboço de `.github/workflows/publicar-extensao.yml`, disparado ao criar uma tag como `vscode-v0.3.0`:

```yaml
name: Publicar extensão
on:
	push:
		tags: ['vscode-v*']

jobs:
	publicar:
		runs-on: ubuntu-latest
		permissions:
			contents: read
			id-token: write					# necessário para o OIDC
		defaults:
			run:
				working-directory: editores/vscode
		steps:
			- uses: actions/checkout@v4
			- uses: oven-sh/setup-bun@v2
			- uses: actions/setup-node@v4
				with: { node-version: 20 }
			- run: bun install
			- run: bun run package
			- run: npx @vscode/vsce publish --oidc --packagePath txt2bin-vscode-*.vsix
```

Para publicar uma versão nova:

```sh
git tag vscode-v0.3.0
git push origin vscode-v0.3.0
```

#cuidado[
	Este workflow é um *esboço*: ainda não foi rodado. Na primeira vez, acompanhe a aba *Actions* do GitHub. Se o `bun install` mexer no `bun.lock`, use `bun install --frozen-lockfile` para o CI falhar em vez de alterar dependências.
]

= Sobre tokens (PAT)

O jeito antigo era criar um *Personal Access Token* no Azure DevOps e fazer `vsce login <publisher>` seguido de `vsce publish`. Ainda funciona por pouco tempo:

#cuidado[
	*Em 1º de dezembro de 2026 o Azure DevOps aposenta os tokens "globais"*, o tipo ("All accessible organizations") que a receita tradicional do `vsce` usava. Por isso este roteiro não depende de token: o envio manual e o Trusted Publishing não precisam dele.
]

Se mesmo assim precisar de token antes dessa data:

+ Entre em #link("https://dev.azure.com") com a *mesma conta Microsoft* do publisher (pode ser preciso criar uma organização, gratuita).
+ *User settings* → *Personal access tokens* → *New Token*.
+ *Organization*: All accessible organizations. *Scopes*: Custom defined → *Show all scopes* → *Marketplace* → marque *Manage*.
+ Copie o token (ele só aparece uma vez) e:
	```sh
	cd editores/vscode
	npx @vscode/vsce login <publisher>		 # cola o token quando pedir
	npx @vscode/vsce publish --no-dependencies
	```

Nunca coloque o token no repositório nem em arquivos versionados.

= Open VSX

O Open VSX é a loja aberta, mantida pela Eclipse Foundation, usada pelos editores que não podem usar o Marketplace da Microsoft (VSCodium, Cursor, Gitpod, Theia). Publicar lá dobra o alcance com o mesmo `.vsix`.

== Conta (uma vez)

+ Crie uma conta na Eclipse Foundation em #link("https://accounts.eclipse.org/user/register"). No campo *GitHub Username*, ponha `HigorFerreira`: é o que liga as duas contas.
+ Entre em #link("https://open-vsx.org") com *Log in with GitHub*.
+ No perfil (*Settings*), conecte a conta Eclipse e aceite o *Publisher Agreement*.
+ Em *Settings → Access Tokens*, gere um token e guarde-o num lugar seguro.

== Publicar

```sh
cd editores/vscode
npx ovsx create-namespace <publisher> -p <token>					# só na primeira vez
npx ovsx publish txt2bin-vscode-X.Y.Z.vsix -p <token>
```

O namespace deve ser o mesmo ID do publisher do Marketplace. A página fica em:

```text
https://open-vsx.org/extension/<publisher>/txt2bin-vscode
```

#nota[
	*Se o ID já existe no Marketplace, a extensão fica inativa.* O Open VSX mostra "Namespace not verified: higorferreira already exists in another gallery" e a extensão não pode ser instalada até o dono provar a posse. Isso evita que alguém publique uma cópia falsa usando o nome de um publisher conhecido. Clique em *Claim Ownership*; o pedido vira uma issue pública em #link("https://github.com/EclipseFdn/open-vsx.org/issues"). Nela, mostre a página da extensão no Marketplace e o repositório cujo `package.json` declara o mesmo `publisher`. A análise é manual e pode levar dias. Depois de aprovada, a extensão fica ativa e verificada, sem precisar publicar de novo.
]

Se o envio for pelo CI, o token vai como segredo do repositório (`OVSX_PAT`) e o passo fica `npx ovsx publish ... -p ${{ secrets.OVSX_PAT }}`.

= Depois de publicar

- *Instale pela loja* numa máquina limpa (ou desinstale a versão local antes) e abra um `.ttb` dos `exemplos/` para conferir cores, erros e offsets.
- *README principal:* trocar a instrução "gere o `.vsix`" por um link para a página no Marketplace, e acrescentar um selo:
	```markdown
	[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/<publisher>.txt2bin-vscode)](https://marketplace.visualstudio.com/items?itemName=<publisher>.txt2bin-vscode)
	```
- *CONTEXTO.md:* registrar o ID do publisher, a data da estreia e as URLs das duas lojas; marcar o item no `docs/roadmap.md` (seção 3).
- *Guia da extensão* (`docs/extensao-vscode/`): atualizar os trechos que ainda mostram o marcador `seu-publisher`.

= Lista de conferência

*Preparação* (qualquer rede):
- ☐ ID do publisher escolhido
- ☐ `publisher` trocado no `package.json`
- ☑ ícone PNG ≥ 128 × 128 e campo `icon` (feito)
- ☐ `LICENSE` copiada para `editores/vscode/`
- ☐ `--skip-license` e `--allow-missing-repository` removidos do script
- ☐ `description` e README da extensão em inglês (ou bilíngues)
- ☐ `CHANGELOG.md` da extensão
- ☐ versão nova no `package.json`
- ☐ `bun run package` passa; `.vsix` conferido e testado localmente

*Marketplace* (fora da rede do trabalho):
- ☐ conta Microsoft e publisher criado com o ID escolhido
- ☐ `.vsix` enviado em *New extension → Visual Studio Code*
- ☐ verificação concluída e página no ar

*Open VSX*:
- ☐ conta Eclipse com o GitHub `HigorFerreira`
- ☐ Publisher Agreement aceito e token gerado
- ☐ `ovsx create-namespace` e `ovsx publish`
- ☐ posse do namespace reivindicada (*Claim Ownership*) e aprovada

*Depois*:
- ☐ instalação pela loja testada
- ☐ README, CONTEXTO, roadmap e guia atualizados
