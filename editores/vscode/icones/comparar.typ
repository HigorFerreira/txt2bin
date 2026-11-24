#import "ideias.typ": *
#set page(width: auto, height: auto, margin: 14pt, fill: rgb("#181818"))
#set text(fill: rgb("#cccccc"), size: 13pt, font: "Helvetica Neue")

#let linha(icone, nome) = grid(columns: (16pt, auto), column-gutter: 6pt, align: horizon, icone, nome)
#let explorador(titulo, icone) = block(width: 190pt, inset: 8pt, fill: rgb("#181818"), stroke: 0.5pt + rgb("#2b2b2b"), {
  text(size: 11pt, fill: rgb("#8b8b8b"), weight: "bold", titulo)
  v(4pt)
  stack(spacing: 6pt,
    linha(seti-info(16pt), [README.md]),
    linha(seti-md(16pt), [especificacao.md]),
    linha(icone(16pt, ciano), [midi.ttb]),
    linha(seti-png(16pt), [logo.png]),
    linha(icone(16pt, ciano), [pdf-minimo.ttb]),
    linha(seti-json(16pt), [package.json]),
  )
})
#let grande(icone) = stack(dir: ltr, spacing: 14pt,
  box(width: 96pt, height: 96pt, fill: rgb("#202020"), inset: 8pt, icone(80pt, ciano)),
  box(width: 96pt, height: 96pt, fill: rgb("#202020"), inset: 8pt, icone(80pt, grad)),
)
#let ideias = (("1 · <<", chevrons), ("2 · T com pixels", tpix), ("3 · < e bytes", chevbits), ("4 · 01", zeroum))
#grid(columns: 2, column-gutter: 24pt, row-gutter: 20pt,
  ..ideias.map(((n, f)) => stack(spacing: 8pt, text(fill: white, size: 13pt, weight: "bold", n), explorador("EXEMPLOS", f), grande(f))))
