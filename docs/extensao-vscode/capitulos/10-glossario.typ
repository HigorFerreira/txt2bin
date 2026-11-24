#import "../estilo.typ": *

#heading(numbering: none)[Glossário]

#table(
  columns: (auto, 1fr),
  table.header[termo][significado],
  [*ativação*], [o momento em que o VS Code carrega a extensão e chama `activate`],
  [*`contributes`*], [o que a extensão declara no manifesto: linguagens, gramáticas, comandos, configurações],
  [*debounce*], [esperar uma pausa nos eventos antes de agir],
  [*diagnóstico*], [um problema mostrado no editor: sublinhado mais uma entrada no painel Problemas],
  [*document symbol*], [um item do Outline e dos breadcrumbs],
  [*escopo*], [o nome hierárquico de um trecho, como `constant.numeric.hex.txt2bin`],
  [*Extension Host*], [o processo separado, com Node, onde o VS Code roda o código das extensões],
  [*gramática TextMate*], [regras de expressão regular que dividem o texto em trechos com nomes],
  [*inlay hint*], [texto desenhado no editor que não faz parte do arquivo],
  [*lookahead*], [`(?=…)` numa expressão regular: confere o que vem a seguir sem consumir],
  [*Oniguruma*], [o motor de expressões regulares usado pelas gramáticas TextMate],
  [*Open VSX*], [registro aberto de extensões, alternativo ao Marketplace],
  [*provedor*], [objeto que o VS Code consulta para um recurso: hover, definição, inlay hints, símbolos],
  [*`ruleStack`*], [o estado da tokenização, passado de uma linha para a próxima],
  [*tema*], [mapeia escopos para cores e estilos],
  [*token*], [um trecho de texto com sua pilha de escopos],
  [*`.vsix`*], [o pacote instalável de uma extensão; um ZIP com outro nome],
  [*`vsce`*], [a ferramenta oficial para empacotar e publicar extensões],
)
