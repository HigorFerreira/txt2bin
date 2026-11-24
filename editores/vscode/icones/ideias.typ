// Ícones de arquivo .ttb, desenhados numa grade 16 × 16 (1 unidade = 1 pixel em 16 px).
#let ciano = rgb("#22b8cf")
#let indigo = rgb("#6d72f0")
#let grad = gradient.linear(indigo, rgb("#22c3d6"), angle: 45deg)

#let traco(u, cor, ..pts) = {
  let p = pts.pos().map(((x, y)) => (x * u, y * u))
  place(curve(stroke: (paint: cor, thickness: 2.6 * u, cap: "butt", join: "miter"),
    curve.move(p.first()), ..p.slice(1).map(q => curve.line(q))))
}
#let ret(u, cor, x, y, w, h, r: 0.6) = place(dx: x * u, dy: y * u, rect(width: w * u, height: h * u, radius: r * u, fill: cor))

// 1 · "<<": a marca de seção, como o M↓ do Markdown
#let chevrons(s, cor) = box(width: s, height: s, {
  let u = s / 16
  traco(u, cor, (7.2, 2), (2, 8), (7.2, 14))
  traco(u, cor, (14.6, 2), (9.4, 8), (14.6, 14))
})
// 2 · o T da loja, reduzido: barra que vira dois pixels
#let tpix(s, cor) = box(width: s, height: s, {
  let u = s / 16
  ret(u, cor, 0.5, 1.5, 9, 3.4)
  ret(u, cor, 3.3, 1.5, 3.4, 13)
  ret(u, cor, 10.3, 1.5, 3.4, 3.4)
  ret(u, cor, 12.4, 6.4, 2.6, 2.6)
})
// 3 · "<" seguido de bytes
#let chevbits(s, cor) = box(width: s, height: s, {
  let u = s / 16
  traco(u, cor, (7, 2), (1.6, 8), (7, 14))
  for (x, y) in ((9, 4), (12.6, 4), (9, 8.6), (12.6, 8.6)) { ret(u, cor, x, y, 3.4, 3.4) }
})
// 4 · "01"
#let zeroum(s, cor) = box(width: s, height: s, align(center + horizon,
  text(font: "DejaVu Sans Mono", weight: "bold", size: s * 0.78, fill: cor, tracking: -0.04em, baseline: 0pt)[01]))

// Imitações aproximadas dos ícones do Seti, só para comparar
#let seti-md(s) = box(width: s, height: s, align(center + horizon, text(font: "DejaVu Sans", weight: "bold", size: s * 0.62, fill: rgb("#519aba"))[M#sym.arrow.b]))
#let seti-png(s) = box(width: s, height: s, {
  let u = s / 16
  let c = rgb("#a074c4")
  place(dx: 1 * u, dy: 2.5 * u, rect(width: 14 * u, height: 11 * u, radius: 1 * u, stroke: 2 * u + c))
  place(curve(fill: c, curve.move((3 * u, 12 * u)), curve.line((7 * u, 7 * u)), curve.line((10 * u, 10 * u)), curve.line((11.5 * u, 8.5 * u)), curve.line((13 * u, 12 * u)), curve.close()))
  place(dx: 10.5 * u, dy: 4.5 * u, circle(radius: 1.3 * u, fill: c))
})
#let seti-json(s) = box(width: s, height: s, align(center + horizon, text(font: "DejaVu Sans Mono", weight: "bold", size: s * 0.8, fill: rgb("#cbcb41"))[{}]))
#let seti-info(s) = box(width: s, height: s, {
  let u = s / 16
  place(dx: 1 * u, dy: 1 * u, circle(radius: 7 * u, fill: rgb("#519aba")))
  place(dx: 7 * u, dy: 3.2 * u, rect(width: 2 * u, height: 2 * u, fill: rgb("#181818")))
  place(dx: 7 * u, dy: 6.5 * u, rect(width: 2 * u, height: 6.5 * u, fill: rgb("#181818")))
})
