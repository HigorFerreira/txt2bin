import * as vscode from 'vscode';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { definirIdioma, ehErroFonte, formatar, idioma, mapa, montar, FORMATOS, type Config, type Formato, type Resultado } from '../../../src/index.ts';

const LINGUAGEM = 'txt2bin';
const resultados = new Map<string, Resultado>();          // último resultado válido por documento
let diagnosticos: vscode.DiagnosticCollection;
let saida: vscode.OutputChannel;
const mudouHints = new vscode.EventEmitter<void>();

const cfg = () => vscode.workspace.getConfiguration('txt2bin');
const emPortugues = () => idioma() === 'pt';

function lerConfig(doc: vscode.TextDocument): Config | undefined {
  if (doc.uri.scheme !== 'file') return undefined;
  const arq = join(dirname(doc.uri.fsPath), 'txt2bin.config.json');
  if (!existsSync(arq)) return undefined;
  try { return JSON.parse(readFileSync(arq, 'utf8')); } catch { return undefined; }
}

// ---------------------------------------------------------------------------
// Diagnósticos: roda o conversor e transforma ErroFonte em sublinhado
// ---------------------------------------------------------------------------
function analisar(doc: vscode.TextDocument): Resultado | undefined {
  if (doc.languageId !== LINGUAGEM) return;
  try {
    const r = montar(doc.getText(), { config: lerConfig(doc) });
    resultados.set(doc.uri.toString(), r);
    diagnosticos.set(doc.uri, []);
    mudouHints.fire();
    return r;
  } catch (e) {
    const linha = ehErroFonte(e) ? Math.min(Math.max(e.linha - 1, 0), doc.lineCount - 1) : 0;
    const texto = doc.lineAt(linha);
    const intervalo = new vscode.Range(linha, texto.firstNonWhitespaceCharacterIndex, linha, texto.text.length);
    const d = new vscode.Diagnostic(intervalo, (e as Error).message, vscode.DiagnosticSeverity.Error);
    d.source = 'txt2bin';
    diagnosticos.set(doc.uri, [d]);
  }
}

const temporizadores = new Map<string, ReturnType<typeof setTimeout>>();
function agendar(doc: vscode.TextDocument, atraso: number) {
  if (doc.languageId !== LINGUAGEM) return;
  const k = doc.uri.toString();
  clearTimeout(temporizadores.get(k));
  temporizadores.set(k, setTimeout(() => analisar(doc), atraso));
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const hex = (n: number | bigint) => '0x' + n.toString(16).toUpperCase();
const RE_ROTULO = /\$[A-Za-z_][\w.]*/;

function itemDaLinha(r: Resultado, linha: number) {
  return r.itens.find(it => it.secao.linha === linha + 1);
}

function linhaDoRotulo(doc: vscode.TextDocument, nome: string): number {
  for (let i = 0; i < doc.lineCount; i++) if (doc.lineAt(i).text.trim() === `<<@${nome}` || doc.lineAt(i).text.startsWith(`<<@${nome} `)) return i;
  return -1;
}

// ---------------------------------------------------------------------------
// Ativação
// ---------------------------------------------------------------------------
export function activate(ctx: vscode.ExtensionContext) {
  // mensagens do conversor no idioma do VS Code, não no do sistema
  definirIdioma(vscode.env.language.toLowerCase().startsWith('pt') ? 'pt' : 'en');
  diagnosticos = vscode.languages.createDiagnosticCollection('txt2bin');
  saida = vscode.window.createOutputChannel('txt2bin');
  const sel: vscode.DocumentSelector = { language: LINGUAGEM };

  ctx.subscriptions.push(
    diagnosticos, saida,

    vscode.workspace.onDidOpenTextDocument(d => { if (cfg().get('validacao') !== 'desligada') agendar(d, 0); }),
    vscode.workspace.onDidChangeTextDocument(e => { if (cfg().get('validacao') === 'aoDigitar') agendar(e.document, cfg().get<number>('atraso', 400)); }),
    vscode.workspace.onDidSaveTextDocument(d => { if (cfg().get('validacao') !== 'desligada') agendar(d, 0); }),
    vscode.workspace.onDidCloseTextDocument(d => { diagnosticos.delete(d.uri); resultados.delete(d.uri.toString()); }),

    // Passar o mouse: valor de rótulos e posição de seções
    vscode.languages.registerHoverProvider(sel, {
      provideHover(doc, pos) {
        const r = resultados.get(doc.uri.toString());
        if (!r) return;
        const faixa = doc.getWordRangeAtPosition(pos, RE_ROTULO);
        if (faixa) {
          const nome = doc.getText(faixa).slice(1);
          const v = r.rotulos.get(nome);
          if (v === undefined) return;
          return new vscode.Hover(new vscode.MarkdownString(`**$${nome}** = \`${v}\` · \`${hex(v)}\``), faixa);
        }
        const it = itemDaLinha(r, pos.line);
        if (!it || it.tipo === 'comentario') return;
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**<<${it.secao.cabecalho}**\n\n`);
        md.appendMarkdown(`offset \`${it.offset}\` · \`${hex(it.offset)}\`  \n`);
        if (it.tipo !== 'rotulo') md.appendMarkdown(emPortugues()
          ? `tamanho \`${it.tamanho}\` byte(s) · termina em \`${hex(it.offset + it.tamanho)}\``
          : `size \`${it.tamanho}\` byte(s) · ends at \`${hex(it.offset + it.tamanho)}\``);
        if (it.bytes && it.tipo === 'asm' && it.bytes.length <= 64)
          md.appendCodeblock(Buffer.from(it.bytes).toString('hex').replace(/(..)/g, '$1 ').trim(), 'text');
        return new vscode.Hover(md);
      },
    }),

    // Ir para a definição de um rótulo
    vscode.languages.registerDefinitionProvider(sel, {
      provideDefinition(doc, pos) {
        const faixa = doc.getWordRangeAtPosition(pos, RE_ROTULO);
        if (!faixa) return;
        const l = linhaDoRotulo(doc, doc.getText(faixa).slice(1));
        return l >= 0 ? new vscode.Location(doc.uri, new vscode.Position(l, 3)) : undefined;
      },
    }),

    // Offset e tamanho ao fim de cada cabeçalho
    vscode.languages.registerInlayHintsProvider(sel, {
      onDidChangeInlayHints: mudouHints.event,
      provideInlayHints(doc, faixa) {
        if (!cfg().get<boolean>('mostrarOffsets', true)) return [];
        const r = resultados.get(doc.uri.toString());
        if (!r) return [];
        const out: vscode.InlayHint[] = [];
        for (const it of r.itens) {
          const l = it.secao.linha - 1;
          if (it.tipo === 'comentario' || l < faixa.start.line || l > faixa.end.line || l >= doc.lineCount) continue;
          const txt = it.tipo === 'rotulo' ? `= ${hex(it.offset)}` : `${hex(it.offset)} · ${it.tamanho} B`;
          const h = new vscode.InlayHint(doc.lineAt(l).range.end, txt, vscode.InlayHintKind.Type);
          h.paddingLeft = true;
          out.push(h);
        }
        return out;
      },
    }),

    // Estrutura (outline / breadcrumbs)
    vscode.languages.registerDocumentSymbolProvider(sel, {
      provideDocumentSymbols(doc) {
        const simbolos: vscode.DocumentSymbol[] = [];
        let atual: vscode.DocumentSymbol | undefined;
        for (let i = 0; i < doc.lineCount; i++) {
          const t = doc.lineAt(i).text;
          if (!t.startsWith('<<')) continue;
          if (atual) atual.range = new vscode.Range(atual.range.start, doc.lineAt(i - 1).range.end);
          const cab = t.slice(2).trim();
          if (cab.startsWith('#')) { atual = undefined; continue; }
          const rotulo = cab.startsWith('@');
          const s = new vscode.DocumentSymbol(rotulo ? cab.slice(1) : cab.split(/\s/)[0]!, rotulo ? '' : cab.split(/\s/).slice(1).join(' '),
            rotulo ? vscode.SymbolKind.Key : vscode.SymbolKind.Field, doc.lineAt(i).range, doc.lineAt(i).range);
          simbolos.push(s);
          atual = rotulo ? undefined : s;
        }
        if (atual) atual.range = new vscode.Range(atual.range.start, doc.lineAt(doc.lineCount - 1).range.end);
        return simbolos;
      },
    }),

    // Comandos
    vscode.commands.registerCommand('txt2bin.gerar', async () => {
      const ed = vscode.window.activeTextEditor;
      if (!ed || ed.document.languageId !== LINGUAGEM) return;
      const r = analisar(ed.document);
      if (!r) { vscode.window.showErrorMessage(emPortugues() ? 'txt2bin: corrija os erros antes de gerar.' : 'txt2bin: fix the errors before generating.'); return; }
      const formato = (await vscode.window.showQuickPick([...FORMATOS], { placeHolder: emPortugues() ? 'Formato de saída' : 'Output format' })) as Formato | undefined;
      if (!formato) return;
      const ext = { bin: '.bin', hex: '.hex.txt', base64: '.b64', base64url: '.b64', datauri: '.datauri.txt', ihex: '.hex' }[formato];
      const base = ed.document.uri.scheme === 'file' ? ed.document.uri.fsPath.replace(/\.ttb$/i, '') : 'saida';
      const destino = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(base + ext) });
      if (!destino) return;
      writeFileSync(destino.fsPath, formatar(r.bytes, formato));
      vscode.window.showInformationMessage(`txt2bin: ${r.bytes.length} bytes → ${destino.fsPath}`);
    }),
    vscode.commands.registerCommand('txt2bin.mapa', () => {
      const ed = vscode.window.activeTextEditor;
      if (!ed || ed.document.languageId !== LINGUAGEM) return;
      const r = analisar(ed.document);
      if (!r) return;
      saida.clear();
      saida.appendLine(mapa(r));
      saida.show(true);
    }),
    vscode.commands.registerCommand('txt2bin.hex', () => {
      const ed = vscode.window.activeTextEditor;
      if (!ed || ed.document.languageId !== LINGUAGEM) return;
      const r = analisar(ed.document);
      if (!r) return;
      saida.clear();
      for (let i = 0; i < r.bytes.length; i += 16) {
        const linha = [...r.bytes.subarray(i, i + 16)];
        const h = linha.map(b => b.toString(16).padStart(2, '0')).join(' ');
        const a = linha.map(b => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
        saida.appendLine(`${i.toString(16).padStart(8, '0')}  ${h.padEnd(47)}  ${a}`);
      }
      saida.show(true);
    }),
  );

  vscode.workspace.textDocuments.forEach(d => agendar(d, 0));
}

export function deactivate() {}
