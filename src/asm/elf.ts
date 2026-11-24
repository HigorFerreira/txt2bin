/** Leitor mínimo de ELF (32/64 bits, little/big-endian): só seções. */

export interface SecaoElf {
  nome: string;
  tipo: number;
  flags: bigint;
  endereco: bigint;
  offset: number;
  tamanho: number;
  alinhamento: number;
}

export const SHT_SYMTAB = 2, SHT_RELA = 4, SHT_NOBITS = 8, SHT_REL = 9;
export const SHF_ALLOC = 2n;

export function lerElf(buf: Uint8Array) {
  if (buf[0] !== 0x7f || buf[1] !== 0x45 || buf[2] !== 0x4c || buf[3] !== 0x46) throw new Error('não é um arquivo ELF');
  const bits: 32 | 64 = buf[4] === 2 ? 64 : 32;
  const le = buf[5] === 1;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u16 = (o: number) => dv.getUint16(o, le);
  const u32 = (o: number) => dv.getUint32(o, le);
  const uN = (o: number) => (bits === 64 ? dv.getBigUint64(o, le) : BigInt(u32(o)));

  const shoff = Number(bits === 64 ? dv.getBigUint64(0x28, le) : BigInt(u32(0x20)));
  const shentsize = u16(bits === 64 ? 0x3a : 0x2e);
  const shnum = u16(bits === 64 ? 0x3c : 0x30);
  const shstrndx = u16(bits === 64 ? 0x3e : 0x32);

  const brutas = [];
  for (let i = 0; i < shnum; i++) {
    const b = shoff + i * shentsize;
    brutas.push(bits === 64
      ? { nome: u32(b), tipo: u32(b + 4), flags: uN(b + 8), endereco: uN(b + 0x10), offset: Number(uN(b + 0x18)), tamanho: Number(uN(b + 0x20)), alinhamento: Number(uN(b + 0x30)) }
      : { nome: u32(b), tipo: u32(b + 4), flags: uN(b + 8), endereco: uN(b + 0x0c), offset: u32(b + 0x10), tamanho: u32(b + 0x14), alinhamento: u32(b + 0x20) });
  }
  const strtab = brutas[shstrndx]!;
  const nomeEm = (o: number) => {
    let s = '', p = strtab.offset + o;
    while (buf[p]) s += String.fromCharCode(buf[p++]!);
    return s;
  };
  const secoes = brutas.map(s => ({ ...s, nome: nomeEm(s.nome), link: 0 }));
  brutas.forEach((_, i) => { secoes[i]!.link = u32(shoff + i * shentsize + (bits === 64 ? 0x28 : 0x18)); });
  return { secoes, bits, le, simbolo: (nome: string) => simbolo(buf, dv, secoes, bits, le, nome) };
}

/** Valor de um símbolo da .symtab (ou undefined). */
function simbolo(buf: Uint8Array, dv: DataView, secoes: (SecaoElf & { link: number })[], bits: number, le: boolean, nome: string): bigint | undefined {
  const tab = secoes.find(s => s.tipo === SHT_SYMTAB);
  if (!tab) return undefined;
  const str = secoes[tab.link]!;
  const tam = bits === 64 ? 24 : 16;
  for (let o = tab.offset; o + tam <= tab.offset + tab.tamanho; o += tam) {
    let p = str.offset + dv.getUint32(o, le), n = '';
    while (buf[p]) n += String.fromCharCode(buf[p++]!);
    if (n === nome) return bits === 64 ? dv.getBigUint64(o + 8, le) : BigInt(dv.getUint32(o + 4, le));
  }
  return undefined;
}

export function conteudo(buf: Uint8Array, s: SecaoElf): Uint8Array {
  if (s.tipo === SHT_NOBITS) return new Uint8Array(s.tamanho);
  return buf.slice(s.offset, s.offset + s.tamanho);
}
