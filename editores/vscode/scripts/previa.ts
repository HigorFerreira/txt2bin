// Gera previa.html: os exemplos coloridos com as cores aproximadas do tema Dark+.
// Uso: bun run previa [arquivos .ttb...]   (padrão: todos os exemplos)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tokenizar } from '../test/gramatica.ts';

// Escopo → cor. O tema escolhe a regra mais específica; aqui, a primeira que casar
// percorrendo do escopo mais interno para o mais externo.
const TEMA: [RegExp, string][] = [
  [/^comment/, '#6A9955'], [/^invalid/, '#F44747'], [/^constant\.character\.escape/, '#D7BA7D'],
  [/^string/, '#CE9178'], [/^constant\.numeric/, '#B5CEA8'], [/^constant\.character/, '#CE9178'],
  [/^constant\.language/, '#569CD6'], [/^keyword\.control/, '#C586C0'], [/^keyword\.operator\.endianness/, '#FF8C42'],
  [/^keyword\.operator/, '#D4D4D4'], [/^keyword\.other\.mnemonic/, '#569CD6'], [/^storage/, '#569CD6'],
  [/^entity\.name\.type/, '#4EC9B0'], [/^entity\.name\.label/, '#DCDCAA'], [/^support\.function/, '#DCDCAA'],
  [/^variable\.other\.label/, '#9CDCFE'], [/^punctuation\.definition\.variable/, '#9CDCFE'],
  [/^variable\.parameter/, '#9CDCFE'], [/^variable\.language\.register/, '#4FC1FF'],
  [/^punctuation\.definition\.directive/, '#C586C0'], [/^punctuation\.section\.embedded/, '#569CD6'],
  [/^punctuation\.definition\.comment/, '#6A9955'],
];
const cor = (escopos: string[]) => {
  for (let i = escopos.length - 1; i >= 0; i--) for (const [re, c] of TEMA) if (re.test(escopos[i]!)) return c;
  return '#D4D4D4';
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const dir = join(import.meta.dir, '../../../exemplos');
const arquivos = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(dir).filter(f => f.endsWith('.ttb')).map(f => join(dir, f));
let html = '';
for (const arq of arquivos) {
  const fonte = readFileSync(arq, 'utf8');
  const tokens = await tokenizar(fonte);
  const linhas = fonte.split('\n').map((l, i) => {
    // reconstrói a linha com espaços originais entre os tokens
    let pos = 0, out = '';
    for (const t of tokens.filter(t => t.linha === i + 1)) {
      const k = l.indexOf(t.texto, pos);
      out += esc(l.slice(pos, k)) + `<span style="color:${cor(t.escopos)}" title="${t.escopo}">${esc(t.texto)}</span>`;
      pos = k + t.texto.length;
    }
    return `<span class="n">${i + 1}</span>${out}${esc(l.slice(pos))}`;
  });
  html += `<div class="t">${arq.split('/').pop()}</div><pre>${linhas.join('\n')}</pre>`;
}
writeFileSync('previa.html', `<!DOCTYPE html><meta charset="utf-8"><title>Prévia do realce</title>
<body style="background:#1e1e1e;color:#d4d4d4;margin:0;padding:12px;font:13px/1.5 Menlo,Consolas,monospace">
<style>.n{color:#6e7681;display:inline-block;width:3ch;text-align:right;margin-right:2ch}
.t{color:#ccc;background:#2d2d2d;padding:4px 10px;font-family:sans-serif}pre{margin:0 0 14px}</style>
<p style="font-family:sans-serif;color:#888">Passe o mouse sobre um trecho para ver o escopo.</p>${html}</body>`);
console.log(`previa.html: ${arquivos.length} arquivo(s)`);
