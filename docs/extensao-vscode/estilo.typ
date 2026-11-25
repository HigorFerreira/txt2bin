// Estilo e componentes do guia da extensão do VS Code.
// Usa só as fontes que vêm embutidas no Typst, para compilar em qualquer máquina.

#let azul = rgb("#1f5fa8")
#let verde = rgb("#2e7d32")
#let laranja = rgb("#c25e00")
#let vermelho = rgb("#b3261e")
#let cinza = luma(110)

#let documento(titulo: "", subtitulo: "", autor: "", data: "", corpo) = {
	set document(title: titulo, author: autor)
	set text(lang: "pt", region: "br", size: 10.5pt)
	set par(justify: true, leading: 0.7em, spacing: 1.1em)
	set page(
		paper: "a4",
		margin: (x: 2.3cm, y: 2.4cm),
		numbering: "1",
		header: context {
			if counter(page).get().first() > 1 {
				set text(size: 8.5pt, fill: cinza)
				titulo
				h(1fr)
				subtitulo
			}
		},
	)
	set heading(numbering: "1.1")
	show heading.where(level: 1): it => {
		pagebreak(weak: true)
		v(1.5cm)
		set text(size: 20pt, fill: azul)
		block(below: 1.2em, it)
	}
	show heading.where(level: 2): set text(size: 13pt, fill: azul.darken(20%))
	show heading.where(level: 3): set text(size: 11pt)

	show raw.where(block: false): box.with(
		fill: luma(240), inset: (x: 2.5pt), outset: (y: 2.5pt), radius: 2pt,
	)
	show raw.where(block: true): set text(size: 8.8pt)
	show raw.where(block: true): block.with(
		width: 100%, fill: luma(246), inset: 9pt, radius: 4pt, stroke: 0.5pt + luma(215),
	)

	set table(stroke: 0.5pt + luma(200), inset: 6pt)
	show table.cell.where(y: 0): set text(weight: "bold")
	show table: set text(size: 9.5pt)
	show link: set text(fill: azul)

	// Capa
	page(numbering: none, header: none)[
		#v(5cm)
		#text(size: 30pt, weight: "bold", fill: azul)[#titulo]
		#v(0.3cm)
		#text(size: 15pt, fill: cinza)[#subtitulo]
		#v(1fr)
		#line(length: 100%, stroke: 0.6pt + azul)
		#text(size: 10pt)[#autor #h(1fr) #data]
	]

	{
		set page(numbering: none, header: none)
		outline(depth: 2, title: [Sumário])
	}
	pagebreak(weak: true)
	counter(page).update(1)

	corpo
}

// Caixas de destaque
#let caixa(titulo, cor, corpo) = block(
	width: 100%,
	inset: (x: 11pt, y: 9pt),
	radius: (right: 4pt),
	fill: cor.lighten(90%),
	stroke: (left: 3pt + cor),
	breakable: true,
)[
	#text(fill: cor, weight: "bold", size: 9.5pt, upper(titulo))
	#v(-0.4em)
	#corpo
]

#let nota(corpo) = caixa("Nota", azul, corpo)
#let experimente(corpo) = caixa("Experimente", verde, corpo)
#let bastidores(corpo) = caixa("Bastidores", laranja, corpo)
#let cuidado(corpo) = caixa("Cuidado", vermelho, corpo)

// Diagramas simples: etapas em caixas ligadas por setas
#let etapa(corpo, cor: azul) = box(
	inset: (x: 7pt, y: 6pt),
	radius: 3pt,
	fill: cor.lighten(88%),
	stroke: 0.7pt + cor,
	text(size: 9pt, corpo),
)

#let fluxo(..passos) = {
	let ps = passos.pos()
	let celulas = ()
	for (i, p) in ps.enumerate() {
		if i > 0 { celulas.push(text(fill: cinza, sym.arrow.r)) }
		celulas.push(etapa(p))
	}
	align(center, grid(
		columns: celulas.len(),
		column-gutter: 5pt,
		align: horizon + center,
		..celulas,
	))
}

#let fluxo-vertical(..passos) = {
	let ps = passos.pos()
	let itens = ()
	for (i, p) in ps.enumerate() {
		if i > 0 { itens.push(text(fill: cinza, sym.arrow.b)) }
		itens.push(etapa(p))
	}
	align(center, stack(dir: ttb, spacing: 5pt, ..itens.map(x => align(center, x))))
}

// Marca uma linha do tempo: data à esquerda, texto à direita
#let marco(data, corpo) = grid(
	columns: (2.6cm, 1fr),
	column-gutter: 10pt,
	text(fill: azul, weight: "bold", size: 9.5pt, data), corpo,
)
