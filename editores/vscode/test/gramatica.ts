// Carrega a gramática com o mesmo motor de realce do VS Code (vscode-textmate +
// Oniguruma) e transforma um texto em tokens com seus escopos.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as vsctm from 'vscode-textmate';
import * as oniguruma from 'vscode-oniguruma';

const raiz = join(import.meta.dir, '..');
let gramatica: vsctm.IGrammar | null = null;

export async function carregar(): Promise<vsctm.IGrammar> {
  if (gramatica) return gramatica;
  const wasm = readFileSync(join(raiz, 'node_modules/vscode-oniguruma/release/onig.wasm'));
  await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
  const registro = new vsctm.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (p: string[]) => new oniguruma.OnigScanner(p),
      createOnigString: (s: string) => new oniguruma.OnigString(s),
    }),
    loadGrammar: async () => vsctm.parseRawGrammar(readFileSync(join(raiz, 'syntaxes/txt2bin.tmLanguage.json'), 'utf8'), 'g.json'),
  });
  gramatica = (await registro.loadGrammar('source.txt2bin'))!;
  return gramatica;
}

export interface Token { texto: string; escopo: string; escopos: string[]; linha: number; }

/** Tokeniza o documento inteiro. `escopo` é o mais específico (o último). */
export async function tokenizar(fonte: string): Promise<Token[]> {
  const g = await carregar();
  let estado = vsctm.INITIAL;
  const out: Token[] = [];
  fonte.split('\n').forEach((l, i) => {
    const r = g.tokenizeLine(l, estado);
    estado = r.ruleStack;
    for (const t of r.tokens) {
      const texto = l.slice(t.startIndex, t.endIndex);
      if (!texto.trim()) continue;
      out.push({ texto, escopo: t.scopes[t.scopes.length - 1]!, escopos: t.scopes, linha: i + 1 });
    }
  });
  return out;
}
