// Guia didático da extensão do txt2bin para o VS Code.
// Compilar (na raiz do repositório):
//   typst compile docs/extensao-vscode/main.typ docs/extensao-vscode.pdf

#import "estilo.typ": *

#show: documento.with(
  titulo: "A extensão txt2bin para VS Code",
  subtitulo: "Como funciona e como foi concebida",
  autor: "Higor · txt2bin",
  data: "versão da extensão 0.2.1 · novembro de 2026",
)

#include "capitulos/01-introducao.typ"
#include "capitulos/02-historia.typ"
#include "capitulos/03-anatomia.typ"
#include "capitulos/04-gramatica.typ"
#include "capitulos/05-codigo.typ"
#include "capitulos/06-editor.typ"
#include "capitulos/07-build.typ"
#include "capitulos/08-testes.typ"
#include "capitulos/09-receitas.typ"
#include "capitulos/10-glossario.typ"
