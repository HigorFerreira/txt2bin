// Ícone do txt2bin: a letra T (texto) se desfazendo em pixels (bits).
// Gerar (dentro de editores/vscode/icones/):
//   typst compile --format png --ppi 144 icone.typ icone.png                               (256 × 256, Marketplace)
//   typst compile --format svg --input variante=arquivo icone.typ arquivo-ttb.svg          (ícone dos .ttb)

#let variante = sys.inputs.at("variante", default: "loja")
#set page(width: 128pt, height: 128pt, margin: 0pt, fill: none)

#let fundo = gradient.linear(rgb("#4f46e5"), rgb("#06b6d4"), angle: 45deg)

// Um pixel: posição (coluna, linha) na grade, opacidade, tamanho relativo
#let px(x, y, cor, alfa: 100%, escala: 1.0, lado: 10pt) = {
  let l = lado * escala
  place(dx: x + (lado - l) / 2, dy: y + (lado - l) / 2,
    rect(width: l, height: l, radius: l * 0.22, fill: cor.transparentize(100% - alfa)))
}

#let letra(cor, ox: -5pt, oy: 6pt) = {
  // haste e começo da barra, sólidos
  place(dx: ox + 22pt, dy: oy + 26pt, rect(width: 52pt, height: 21pt, radius: (left: 5pt), fill: cor))
  place(dx: ox + 42pt, dy: oy + 26pt, rect(width: 21pt, height: 78pt, radius: (bottom: 5pt), fill: cor))
  // a barra se desfaz em pixels para a direita
  let g = 11pt
  let x0 = ox + 74pt + 1pt
  px(x0, oy + 26pt, cor)
  px(x0, oy + 26pt + g, cor)
  px(x0 + g, oy + 26pt, cor, alfa: 85%)
  px(x0 + g, oy + 26pt + g, cor, alfa: 85%, escala: 0.85)
  px(x0 + 2 * g, oy + 26pt - 3pt, cor, alfa: 65%, escala: 0.8)
  px(x0 + 2 * g + 2pt, oy + 26pt + g + 4pt, cor, alfa: 55%, escala: 0.7)
  px(x0 + 3 * g + 1pt, oy + 26pt + 6pt, cor, alfa: 40%, escala: 0.6)
  px(x0 + 3 * g - 4pt, oy + 26pt - 13pt, cor, alfa: 35%, escala: 0.5)
  px(x0 + 2 * g - 2pt, oy + 26pt + 2 * g + 6pt, cor, alfa: 30%, escala: 0.5)
}

#if variante == "arquivo" {
  // ícone de arquivo: só o símbolo, sem fundo, com a cor do gradiente
  scale(112%, origin: center + horizon, box(width: 128pt, height: 128pt, letra(rgb("#4f8fe8"))))
} else {
  place(rect(width: 128pt, height: 128pt, radius: 28pt, fill: fundo))
  // brilho sutil no alto
  place(rect(width: 128pt, height: 64pt, radius: (top: 28pt),
    fill: gradient.linear(white.transparentize(88%), white.transparentize(100%), angle: 90deg)))
  letra(white)
}
