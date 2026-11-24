/**
 * Arquiteturas suportadas pelo backend LLVM (llvm-mc + ld.lld).
 * Todas são montadas como objetos ELF; o txt2bin extrai só os bytes de .text.
 */
export interface Arquitetura {
	triple: string;
	mcpu?: string;
	mattr?: string;
	/** linhas inseridas antes do código (ex.: .code16) */
	preludio?: string;
	/** x86: usa sintaxe Intel por padrão */
	x86?: boolean;
	descricao: string;
	/** a mesma descrição, em inglês */
	description: string;
}

export const ARQUITETURAS: Record<string, Arquitetura> = {
	// --- Intel / AMD ---------------------------------------------------------
	x86_16: { triple: 'i386-unknown-linux-gnu', preludio: '.code16', x86: true, descricao: 'x86 16 bits (modo real, 8086, setor de boot)', description: 'x86 16-bit (real mode, 8086, boot sectors)' },
	x86: { triple: 'i386-unknown-linux-gnu', x86: true, descricao: 'x86 32 bits (IA-32)', description: 'x86 32-bit (IA-32)' },
	x86_64: { triple: 'x86_64-unknown-linux-gnu', x86: true, descricao: 'x86-64 (AMD64 / Intel 64)', description: 'x86-64 (AMD64 / Intel 64)' },

	// --- ARM -----------------------------------------------------------------
	arm: { triple: 'armv7-unknown-linux-gnueabi', descricao: 'ARM 32 bits, instruções A32 (ARMv7-A)', description: 'ARM 32-bit, A32 instructions (ARMv7-A)' },
	armeb: { triple: 'armebv7-unknown-linux-gnueabi', descricao: 'ARM 32 bits big-endian', description: 'ARM 32-bit big-endian' },
	thumb: { triple: 'thumbv7-unknown-linux-gnueabi', descricao: 'Thumb-2 (ARMv7-A)', description: 'Thumb-2 (ARMv7-A)' },
	cortex_m0: { triple: 'thumbv6m-none-eabi', mcpu: 'cortex-m0', descricao: 'ARM Cortex-M0/M0+ (RP2040, STM32F0)', description: 'ARM Cortex-M0/M0+ (RP2040, STM32F0)' },
	cortex_m3: { triple: 'thumbv7m-none-eabi', mcpu: 'cortex-m3', descricao: 'ARM Cortex-M3 (STM32F1)', description: 'ARM Cortex-M3 (STM32F1)' },
	cortex_m4: { triple: 'thumbv7em-none-eabi', mcpu: 'cortex-m4', descricao: 'ARM Cortex-M4 (STM32F4, nRF52)', description: 'ARM Cortex-M4 (STM32F4, nRF52)' },
	cortex_m33: { triple: 'thumbv8m.main-none-eabi', mcpu: 'cortex-m33', descricao: 'ARM Cortex-M33 (RP2350, nRF5340)', description: 'ARM Cortex-M33 (RP2350, nRF5340)' },
	arm64: { triple: 'aarch64-unknown-linux-gnu', descricao: 'ARM 64 bits (AArch64 / ARMv8-A)', description: 'ARM 64-bit (AArch64 / ARMv8-A)' },
	apple_silicon: { triple: 'aarch64-unknown-linux-gnu', mcpu: 'apple-m1', descricao: 'Apple Silicon (M1 em diante; AArch64 com extensões da Apple)', description: 'Apple Silicon (M1 and later; AArch64 with Apple extensions)' },

	// --- Microcontroladores ----------------------------------------------------
	avr: { triple: 'avr', mcpu: 'atmega328p', descricao: 'Atmel/Microchip AVR (padrão: ATmega328P do Arduino Uno; use mcpu=)', description: 'Atmel/Microchip AVR (default: the Arduino Uno\'s ATmega328P; use mcpu=)' },
	msp430: { triple: 'msp430', descricao: 'TI MSP430', description: 'TI MSP430' },
	xtensa: { triple: 'xtensa', descricao: 'Xtensa (ESP32, ESP8266) — experimental no LLVM', description: 'Xtensa (ESP32, ESP8266) — experimental in LLVM' },

	// --- RISC-V ----------------------------------------------------------------
	riscv32: { triple: 'riscv32-unknown-elf', mattr: '+m,+a,+f,+d,+c,-relax', descricao: 'RISC-V 32 bits (RV32GC)', description: 'RISC-V 32-bit (RV32GC)' },
	riscv64: { triple: 'riscv64-unknown-elf', mattr: '+m,+a,+f,+d,+c,-relax', descricao: 'RISC-V 64 bits (RV64GC)', description: 'RISC-V 64-bit (RV64GC)' },

	// --- MIPS / PowerPC / SPARC / outras ---------------------------------------
	mips: { triple: 'mips-unknown-linux-gnu', descricao: 'MIPS32 big-endian', description: 'MIPS32 big-endian' },
	mipsel: { triple: 'mipsel-unknown-linux-gnu', descricao: 'MIPS32 little-endian (PlayStation 1/2, roteadores)', description: 'MIPS32 little-endian (PlayStation 1/2, routers)' },
	mips64: { triple: 'mips64-unknown-linux-gnuabi64', descricao: 'MIPS64 big-endian', description: 'MIPS64 big-endian' },
	mips64el: { triple: 'mips64el-unknown-linux-gnuabi64', descricao: 'MIPS64 little-endian', description: 'MIPS64 little-endian' },
	ppc: { triple: 'powerpc-unknown-linux-gnu', descricao: 'PowerPC 32 bits (GameCube, Wii)', description: 'PowerPC 32-bit (GameCube, Wii)' },
	ppc64: { triple: 'powerpc64-unknown-linux-gnu', descricao: 'PowerPC 64 bits big-endian', description: 'PowerPC 64-bit big-endian' },
	ppc64le: { triple: 'powerpc64le-unknown-linux-gnu', descricao: 'PowerPC 64 bits little-endian', description: 'PowerPC 64-bit little-endian' },
	sparc: { triple: 'sparc-unknown-linux-gnu', descricao: 'SPARC V8', description: 'SPARC V8' },
	sparcv9: { triple: 'sparcv9-unknown-linux-gnu', descricao: 'SPARC V9 (64 bits)', description: 'SPARC V9 (64-bit)' },
	s390x: { triple: 's390x-unknown-linux-gnu', descricao: 'IBM Z (SystemZ)', description: 'IBM Z (SystemZ)' },
	m68k: { triple: 'm68k-unknown-linux-gnu', mcpu: 'M68000', descricao: 'Motorola 68000 (Mega Drive, Amiga) — backend experimental: faltam instruções como moveq', description: 'Motorola 68000 (Mega Drive, Amiga) — experimental backend: some instructions such as moveq are missing' },
	loongarch64: { triple: 'loongarch64-unknown-linux-gnu', descricao: 'LoongArch 64', description: 'LoongArch 64' },
	hexagon: { triple: 'hexagon-unknown-linux-musl', descricao: 'Qualcomm Hexagon DSP', description: 'Qualcomm Hexagon DSP' },
	bpf: { triple: 'bpfel', descricao: 'eBPF little-endian', description: 'eBPF little-endian' },
};

export const APELIDOS: Record<string, string> = {
	'8086': 'x86_16', real: 'x86_16', x86_real: 'x86_16', i8086: 'x86_16',
	intel_x86: 'x86', i386: 'x86', i686: 'x86', ia32: 'x86', x86_32: 'x86',
	amd64: 'x86_64', x64: 'x86_64', intel_x64: 'x86_64', intel_x86_64: 'x86_64',
	armv7: 'arm', a32: 'arm', arm32: 'arm', t32: 'thumb',
	aarch64: 'arm64', armv8: 'arm64', apple: 'apple_silicon', apple_m1: 'apple_silicon', m1: 'apple_silicon',
	atmel: 'avr', atmega: 'avr', arduino: 'avr',
	rp2040: 'cortex_m0', stm32: 'cortex_m3',
	esp32: 'xtensa', riscv: 'riscv64', rv32: 'riscv32', rv64: 'riscv64',
	powerpc: 'ppc', powerpc64: 'ppc64', systemz: 's390x', s390: 's390x',
	'68000': 'm68k', '68k': 'm68k', loongarch: 'loongarch64', ebpf: 'bpf',
};

export function normalizarNome(nome: string): string {
	const n = nome.trim().toLowerCase().replace(/-/g, '_');
	return APELIDOS[n] ?? n;
}
