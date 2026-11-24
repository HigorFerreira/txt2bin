import { describe, expect, test } from 'bun:test';
import { avaliar } from '../src/expr.ts';
import { paraFloat16 } from '../src/codificar.ts';
import { intelHex } from '../src/saida.ts';
import { montar, ErroFonte } from '../src/index.ts';
import { definirIdioma } from '../src/mensagens.ts';

// os testes conferem o texto das mensagens em português
definirIdioma('pt');

const hex = (fonte: string) => Buffer.from(montar(fonte).bytes).toString('hex');
const erro = (fonte: string) => {
	try { montar(fonte); } catch (e) { if (e instanceof ErroFonte) return `${e.linha}: ${e.message}`; throw e; }
	throw new Error('esperava erro');
};
const ctx = { rotulos: new Map([['a', 10n], ['b', 3n]]), aqui: 100n };

describe('exemplo original', () => {
	test('converte igual à versão em JavaScript', () => {
		expect(hex('<<utf8\nCoisas em strings escritas, json etc\\n\n<<hex\n04ff2345ab5f2c\n<<uint8\n19\n<<uint16\n24\n<<uint32\n1000\n'))
			.toBe(Buffer.from('Coisas em strings escritas, json etc\n').toString('hex') + '04ff2345ab5f2c' + '13' + '1800' + 'e8030000');
	});
});

describe('texto', () => {
	test('quebras reais são ignoradas e escapes funcionam', () => {
		expect(hex('<<utf8\nab\ncd\\n\\s\\t\\\\\\<<\\u{e9}\n')).toBe(Buffer.from('abcd\n \t\\<<é').toString('hex'));
	});
	test('"<<" no meio da linha é texto', () => {
		expect(hex('<<utf8\na << b\n')).toBe(Buffer.from('a << b').toString('hex'));
	});
	test('utf16 little e big-endian', () => {
		expect(hex('<<utf16\nAé\n')).toBe('4100e900');
		expect(hex('<<utf16+\nAé\n')).toBe('004100e9');
	});
});

describe('hex e base64', () => {
	test('hex com comentários', () => expect(hex('<<hex\nde ad # comentário\nbe ef\n')).toBe('deadbeef'));
	test('base64 com e sem preenchimento', () => {
		expect(hex('<<base64\n3q2+7w==\n')).toBe('deadbeef');
		expect(hex('<<base64\n3q2+\n7w\n')).toBe('deadbeef');
	});
	test('base64url', () => expect(hex('<<base64url\n3q2-7w\n')).toBe('deadbeef'));
	test('base64 recusa alfabeto url com dica', () => expect(erro('<<base64\n3q2-7w\n')).toContain('use <<base64url'));
	test('base64url recusa + e /', () => expect(erro('<<base64url\n3q2+7w\n')).toContain('"+"'));
});

describe('números e ordem de bytes', () => {
	test('little-endian por padrão, big-endian com +', () => {
		expect(hex('<<uint32\n0x01020304\n<<uint32+\n0x01020304\n')).toBe('0403020101020304');
		expect(hex('<<float32+\n1\n<<float64+\n1\n')).toBe('3f800000' + '3ff0000000000000');
	});
	test('64 bits exatos', () => {
		expect(hex('<<uint64\n0xffff_ffff_ffff_ffff\n<<int64+\n-2\n')).toBe('ffffffffffffffff' + 'fffffffffffffffe');
	});
	test('float16', () => {
		expect(hex('<<float16\n1 -2 0.5 65504\n')).toBe('003c' + '00c0' + '0038' + 'ff7b');
		expect(paraFloat16(1 / 3)).toBe(0x3555);
		expect(paraFloat16(1e-7)).toBe(0x0002);
	});
	test('"+" em bytes é erro', () => expect(erro('<<hex+\n00\n')).toContain('não se aplica'));
	test('intervalo', () => expect(erro('<<uint8\n1\n256\n')).toBe('3: 256 = 256 está fora do intervalo de uint8 (0…255)'));
	test('real em inteiro', () => expect(erro('<<uint16\n(1/2)\n')).toContain('precisa ser inteiro'));
	test('literal de caractere', () => expect(hex("<<uint8\n'A' '\\n' ('a'+1)\n")).toBe('410a62'));
});

describe('expressões', () => {
	const v = (s: string) => avaliar(s, ctx);
	test('precedência como em Python', () => {
		expect(v('2+3*4')).toBe(14n);
		expect(v('(2+3)*4')).toBe(20n);
		expect(v('-2**2')).toBe(-4n);
		expect(v('2**3**2')).toBe(512n);
		expect(v('1|2^3&4<<1')).toBe(3n);
	});
	test('divisão: exata fica inteira, senão vira real', () => {
		expect(v('10/2')).toBe(5n);
		expect(v('10/4')).toBe(2.5);
		expect(v('-7//2')).toBe(-4n);
		expect(v('-7%3')).toBe(2n);
	});
	test('rótulos, $. e funções', () => {
		expect(v('$a-$b')).toBe(7n);
		expect(v('$.+1')).toBe(101n);
		expect(v('round(sin(pi/2)*1000)')).toBe(1000n);
		expect(v('max(1, 2.5, $b)')).toBe(3n);
		expect(v('rad(180)')).toBe(Math.PI);
	});
	test('espaços só entre parênteses', () => {
		expect(hex('<<uint8\n(1 + 2) 3\n')).toBe('0303');
		expect(erro('<<uint8\n1 + 2\n')).toContain('coloque-a entre parênteses');
	});
});

describe('rótulos e layout', () => {
	test('referência adiante e tamanho de chunk', () => {
		expect(hex('<<uint32\n$fim-$ini\n<<@ini\n<<utf8\nabc\n<<align 4 20\n<<@fim\n')).toBe('04000000' + '61626320');
	});
	test('fill depende de rótulo posterior (ponto fixo)', () => {
		const r = montar('<<@ini\n<<utf8\nboot\n<<fill 510-($.-$ini)\n<<hex\n55aa\n<<@fim\n');
		expect(r.bytes.length).toBe(512);
		expect(r.bytes[510]).toBe(0x55);
	});
	test('fill negativo é erro', () => expect(erro('<<utf8\nabcdef\n<<fill 4-$.\n')).toContain('negativa'));
	test('rótulo indefinido', () => expect(erro('<<uint8\n$nada\n')).toBe('2: rótulo indefinido "$nada"'));
	test('rótulo duplicado', () => expect(erro('<<@a\n<<@a\n')).toContain('já definido'));
	test('conteúdo antes da primeira diretiva', () => expect(erro('oi\n<<hex\n00\n')).toContain('antes da primeira'));
});

describe('Intel HEX', () => {
	test('registro de dados e fim', () => {
		expect(intelHex(Uint8Array.from([0x0c, 0x94, 0x34, 0x00]))).toBe(':040000000C94340028\n:00000001FF\n');
	});
});

describe('parênteses', () => {
	test('linha do "(" sem par', () => expect(erro('<<uint8\n1\n(2 +\n3\n')).toBe('3: "(" sem ")" correspondente'));
	test('")" sobrando', () => expect(erro('<<uint8\n1)\n')).toBe('2: ")" sem "(" correspondente'));
});
