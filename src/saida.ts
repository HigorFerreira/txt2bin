import type { Resultado } from './montar.ts';

export const FORMATOS = ['bin', 'hex', 'base64', 'base64url', 'datauri', 'ihex'] as const;
export type Formato = (typeof FORMATOS)[number];

export function formatar(bytes: Uint8Array, formato: Formato, mime = 'application/octet-stream'): Uint8Array | string {
  const b = Buffer.from(bytes);
  switch (formato) {
    case 'bin': return bytes;
    case 'hex': return b.toString('hex') + '\n';
    case 'base64': return b.toString('base64') + '\n';
    case 'base64url': return b.toString('base64url') + '\n';
    case 'datauri': return `data:${mime};base64,${b.toString('base64')}\n`;
    case 'ihex': return intelHex(bytes);
  }
}

/** Intel HEX (o formato que o avrdude e muitos gravadores esperam). */
export function intelHex(bytes: Uint8Array, base = 0): string {
  const linhas: string[] = [];
  const registro = (tipo: number, endereco: number, dados: number[]) => {
    const r = [dados.length, (endereco >> 8) & 0xff, endereco & 0xff, tipo, ...dados];
    const soma = (-r.reduce((a, b) => a + b, 0)) & 0xff;
    linhas.push(':' + [...r, soma].map(x => x.toString(16).toUpperCase().padStart(2, '0')).join(''));
  };
  let segmentoAtual = -1;
  for (let i = 0; i < bytes.length; i += 16) {
    const end = base + i;
    const segmento = end >>> 16;
    if (segmento !== segmentoAtual) { registro(4, 0, [(segmento >> 8) & 0xff, segmento & 0xff]); segmentoAtual = segmento; }
    registro(0, end & 0xffff, [...bytes.subarray(i, Math.min(i + 16, bytes.length))]);
  }
  registro(1, 0, []);
  // o registro 04 inicial é redundante quando tudo cabe nos primeiros 64 KiB
  if (linhas[0] === ':020000040000FA') linhas.shift();
  return linhas.join('\n') + '\n';
}

/** Tabela com o offset, o tamanho e a distância ao último rótulo de cada seção. */
export function mapa(r: Resultado): string {
  const linhas = ['  offset (hex)   offset   tamanho  relativo            seção'];
  let ultimo: { nome: string; off: number } | null = null;
  for (const it of r.itens) {
    if (it.tipo === 'comentario') continue;
    if (it.tipo === 'rotulo') ultimo = { nome: it.rotulo!, off: it.offset };
    const rel = ultimo && it.tipo !== 'rotulo' ? `@${ultimo.nome}+${it.offset - ultimo.off}` : '';
    const nome = it.tipo === 'rotulo' ? `@${it.rotulo}` : `<<${it.secao.cabecalho}`;
    linhas.push(`  0x${it.offset.toString(16).padStart(8, '0')}  ${String(it.offset).padStart(7)}  ${String(it.tamanho).padStart(7)}  ${rel.padEnd(18)}  ${nome}  (linha ${it.secao.linha})`);
  }
  linhas.push(`  total: ${r.bytes.length} bytes · ${r.rotulos.size} rótulo(s) · ${r.passadas} passada(s) de layout`);
  return linhas.join('\n');
}
