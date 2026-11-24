// Uma imitação mínima da API "vscode", só com o que a extensão usa.
// Permite testar a extensão em Bun, sem abrir o VS Code.
export class Position { constructor(public line: number, public character: number) {} }
export class Range {
  start: Position; end: Position;
  constructor(a: number | Position, b: number | Position, c?: number, d?: number) {
    if (a instanceof Position) { this.start = a; this.end = b as Position; }
    else { this.start = new Position(a, b as number); this.end = new Position(c!, d!); }
  }
}
export class MarkdownString {
  constructor(public value = '') {}
  appendMarkdown(s: string) { this.value += s; return this; }
  appendCodeblock(s: string) { this.value += '\n```\n' + s + '\n```'; return this; }
}
export class Hover { constructor(public contents: MarkdownString, public range?: Range) {} }
export class Location { constructor(public uri: unknown, public range: Position) {} }
export class Diagnostic { source?: string; constructor(public range: Range, public message: string, public severity: number) {} }
export class InlayHint { paddingLeft?: boolean; constructor(public position: Position, public label: string, public kind: number) {} }
export class DocumentSymbol {
  constructor(public name: string, public detail: string, public kind: number, public range: Range, public selectionRange: Range) {
    if (!name || !name.trim()) throw new Error('name must not be falsy');   // como o VS Code real
  }
}
export class EventEmitter<T> { ouvintes: ((x: T) => void)[] = []; event = (f: (x: T) => void) => this.ouvintes.push(f); fire(x: T) { this.ouvintes.forEach(f => f(x)); } }
export const DiagnosticSeverity = { Error: 0 };
export const env = { language: 'pt-br' };
export const InlayHintKind = { Type: 1 };
export const SymbolKind = { Key: 19, Field: 7 };
export const Uri = { file: (fsPath: string) => ({ fsPath }) };

/** O que a extensão registrou fica guardado aqui para os testes consultarem. */
export const registro = {
  provedores: {} as Record<string, any>,
  comandos: {} as Record<string, (...a: any[]) => any>,
  diagnosticos: new Map<string, Diagnostic[]>(),
  saida: [] as string[],
  config: { validacao: 'aoDigitar', atraso: 0, mostrarOffsets: true } as Record<string, unknown>,
};

export const window = {
  activeTextEditor: undefined as { document: unknown } | undefined,
  createOutputChannel: () => ({ clear: () => (registro.saida = []), appendLine: (l: string) => registro.saida.push(l), show() {}, dispose() {} }),
  showErrorMessage() {}, showInformationMessage() {}, showQuickPick: async () => undefined, showSaveDialog: async () => undefined,
};
export const workspace = {
  textDocuments: [] as unknown[],
  getConfiguration: () => ({ get: (k: string, padrao?: unknown) => registro.config[k] ?? padrao }),
  onDidOpenTextDocument: () => ({ dispose() {} }),
  onDidChangeTextDocument: () => ({ dispose() {} }),
  onDidSaveTextDocument: () => ({ dispose() {} }),
  onDidCloseTextDocument: () => ({ dispose() {} }),
};
export const languages = {
  createDiagnosticCollection: () => ({
    set: (uri: { toString(): string }, d: Diagnostic[]) => registro.diagnosticos.set(uri.toString(), d),
    delete() {}, dispose() {},
  }),
  registerHoverProvider: (_: unknown, p: unknown) => (registro.provedores.hover = p),
  registerDefinitionProvider: (_: unknown, p: unknown) => (registro.provedores.definicao = p),
  registerInlayHintsProvider: (_: unknown, p: unknown) => (registro.provedores.hints = p),
  registerDocumentSymbolProvider: (_: unknown, p: unknown) => (registro.provedores.simbolos = p),
};
export const commands = {
  registerCommand: (nome: string, f: (...a: any[]) => any) => (registro.comandos[nome] = f),
};

/** Um TextDocument falso a partir de um texto. */
export function documento(caminho: string, texto: string) {
  const linhas = texto.split('\n');
  return {
    uri: { scheme: 'file', fsPath: caminho, toString: () => caminho },
    languageId: 'txt2bin',
    lineCount: linhas.length,
    getText: (r?: Range) => (r ? linhas[r.start.line]!.slice(r.start.character, r.end.character) : texto),
    lineAt: (i: number) => ({
      text: linhas[i]!,
      firstNonWhitespaceCharacterIndex: linhas[i]!.search(/\S|$/),
      range: new Range(i, 0, i, linhas[i]!.length),
    }),
    getWordRangeAtPosition(p: Position, re: RegExp) {
      const g = new RegExp(re.source, 'g');
      for (let m; (m = g.exec(linhas[p.line]!)); )
        if (p.character >= m.index && p.character <= m.index + m[0].length) return new Range(p.line, m.index, p.line, m.index + m[0].length);
    },
  };
}
