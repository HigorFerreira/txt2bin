import type { Valor } from './expr.ts';

// ---------------------------------------------------------------------------
// Tipos numéricos
// ---------------------------------------------------------------------------
export interface TipoNum {
  bytes: number;
  inteiro: boolean;
  min?: bigint;
  max?: bigint;
  escrever(dv: DataView, off: number, v: Valor, le: boolean): void;
}

const int = (bytes: number, comSinal: boolean, escrever: TipoNum['escrever']): TipoNum => {
  const bits = BigInt(bytes * 8);
  return {
    bytes, inteiro: true, escrever,
    min: comSinal ? -(1n << (bits - 1n)) : 0n,
    max: comSinal ? (1n << (bits - 1n)) - 1n : (1n << bits) - 1n,
  };
};

export const TIPOS: Record<string, TipoNum> = {
  uint8: int(1, false, (dv, o, v) => dv.setUint8(o, Number(v))),
  int8: int(1, true, (dv, o, v) => dv.setInt8(o, Number(v))),
  uint16: int(2, false, (dv, o, v, le) => dv.setUint16(o, Number(v), le)),
  int16: int(2, true, (dv, o, v, le) => dv.setInt16(o, Number(v), le)),
  uint32: int(4, false, (dv, o, v, le) => dv.setUint32(o, Number(v), le)),
  int32: int(4, true, (dv, o, v, le) => dv.setInt32(o, Number(v), le)),
  uint64: int(8, false, (dv, o, v, le) => dv.setBigUint64(o, BigInt(v), le)),
  int64: int(8, true, (dv, o, v, le) => dv.setBigInt64(o, BigInt(v), le)),
  float16: { bytes: 2, inteiro: false, escrever: (dv, o, v, le) => dv.setUint16(o, paraFloat16(Number(v)), le) },
  float32: { bytes: 4, inteiro: false, escrever: (dv, o, v, le) => dv.setFloat32(o, Number(v), le) },
  float64: { bytes: 8, inteiro: false, escrever: (dv, o, v, le) => dv.setFloat64(o, Number(v), le) },
};

/** IEEE 754 binary16, arredondando para o par mais próximo. */
export function paraFloat16(x: number): number {
  const f32 = new Float32Array([x]);
  const u = new Uint32Array(f32.buffer)[0]!;
  const sinal = (u >>> 16) & 0x8000;
  const exp = (u >>> 23) & 0xff;
  let mant = u & 0x7fffff;
  if (exp === 0xff) return sinal | 0x7c00 | (mant ? 0x200 : 0);          // inf / NaN
  let e = exp - 127 + 15;
  if (e >= 0x1f) return sinal | 0x7c00;                                   // estouro → inf
  if (e <= 0) {                                                           // subnormal
    if (e < -10) return sinal;
    mant |= 0x800000;
    const desloc = 14 - e;
    let m = mant >> desloc;
    const resto = mant & ((1 << desloc) - 1), meio = 1 << (desloc - 1);
    if (resto > meio || (resto === meio && (m & 1))) m++;
    return sinal | m;
  }
  let m = mant >> 13;
  const resto = mant & 0x1fff;
  if (resto > 0x1000 || (resto === 0x1000 && (m & 1))) { m++; if (m === 0x400) { m = 0; e++; } }
  if (e >= 0x1f) return sinal | 0x7c00;
  return sinal | (e << 10) | m;
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------
/** Junta as linhas (as quebras reais são ignoradas) e resolve os escapes. */
export function decodificarTexto(corpo: string): string {
  const cru = corpo.replace(/\n/g, '');
  let out = '';
  for (let i = 0; i < cru.length; i++) {
    if (cru[i] !== '\\') { out += cru[i]; continue; }
    const e = cru[++i];
    switch (e) {
      case 'n': out += '\n'; break;
      case 'r': out += '\r'; break;
      case 't': out += '\t'; break;
      case 's': out += ' '; break;
      case '0': out += '\0'; break;
      case '\\': out += '\\'; break;
      case '<': out += '<'; break;
      case 'u': {
        const m = /^\{([0-9a-fA-F]{1,6})\}/.exec(cru.slice(i + 1));
        if (!m) throw new Error('escape \\u inválido, use \\u{HHHH}');
        out += String.fromCodePoint(parseInt(m[1]!, 16));
        i += m[0].length;
        break;
      }
      case undefined: throw new Error('"\\" no fim do texto');
      default: throw new Error(`escape desconhecido "\\${e}"`);
    }
  }
  return out;
}

export function utf16(texto: string, bigEndian: boolean): Uint8Array {
  const out = new Uint8Array(texto.length * 2);
  const dv = new DataView(out.buffer);
  for (let i = 0; i < texto.length; i++) dv.setUint16(i * 2, texto.charCodeAt(i), !bigEndian);
  return out;
}

// ---------------------------------------------------------------------------
// hex / base64
// ---------------------------------------------------------------------------
const semComentarios = (corpo: string) => corpo.split('\n').map(l => l.replace(/#.*$/, '')).join('');

export function hex(corpo: string): Uint8Array {
  const h = semComentarios(corpo).replace(/\s+/g, '');
  if (!/^[0-9a-fA-F]*$/.test(h)) throw new Error('caractere não hexadecimal');
  if (h.length % 2) throw new Error(`número ímpar de dígitos hex (${h.length})`);
  return Uint8Array.from(Buffer.from(h, 'hex'));
}

export function base64(corpo: string, url: boolean): Uint8Array {
  const s = semComentarios(corpo).replace(/\s+/g, '');
  const alfabeto = url ? /^[A-Za-z0-9\-_]*={0,2}$/ : /^[A-Za-z0-9+/]*={0,2}$/;
  if (!alfabeto.test(s)) {
    const errado = [...s].find(c => !(url ? /[A-Za-z0-9\-_=]/ : /[A-Za-z0-9+/=]/).test(c));
    throw new Error(`caractere "${errado}" não pertence ao alfabeto ${url ? 'base64url' : 'base64'}`
      + (url ? '' : errado === '-' || errado === '_' ? ' (isso é base64url? use <<base64url)' : ''));
  }
  const dados = s.replace(/=+$/, '');
  if (dados.length % 4 === 1) throw new Error('comprimento base64 inválido');
  if (s.includes('=') && s.length % 4 !== 0) throw new Error('preenchimento "=" incorreto');
  return Uint8Array.from(Buffer.from(dados, url ? 'base64url' : 'base64'));
}
