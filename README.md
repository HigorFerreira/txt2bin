# txt2bin

**Write binary files as plain text.**

txt2bin turns a readable, commented `.ttb` text file into any binary file you want: a 3D model, a MIDI song, a boot sector, Arduino firmware, a test fixture for your parser. Hex bytes, text, base64, integers and floats in either byte order, math expressions, labels that compute sizes and offsets for you, and inline assembly for 30+ CPU architectures can all go in the same file.

```text
<<# A playable MIDI file: a C-major arpeggio.
<<utf8
MThd
<<uint32+
6                  # header length (MIDI is big-endian: "+")
<<uint16+
0 1 96             # format 0, one track, 96 ticks per beat
<<utf8
MTrk
<<uint32+
$end-$start        # track length: computed for you
<<@start
<<hex
00 C0 00           # piano
00 90 3C 64        # C4 on
60 80 3C 40        # C4 off, one beat later
00 90 40 64  60 80 40 40     # E4
00 90 43 64  60 80 43 40     # G4
00 90 48 64        # C5 on...
<<uint8
(0x80 | (192 >> 7))  (192 & 0x7F)   # ...for two beats (VLQ-encoded delta)
<<hex
80 48 40
00 FF 2F 00        # end of track
<<@end
```

```sh
npx txt2bin song.ttb song.mid      # 62 bytes. Play it in GarageBand, MuseScore or any MIDI player.
```

---

## Why txt2bin?

Hand-crafting a binary file usually means picking your poison:

- **A hex editor.** No comments, no structure, and every time you add a byte you recompute every length and offset by hand.
- **`xxd -r` or `printf '\x..'`.** Same problem, now in a shell script.
- **A Python script with `struct.pack`.** Works, but the file format disappears under the code that writes it.
- **An assembler's `db`/`dw`.** Great labels and math, but one architecture and no text encodings or base64.

txt2bin is the missing middle ground: **the file *is* the format.** You read it top to bottom and see exactly what lands in each byte, with the comments right next to it.

| | hex editor | `struct.pack` script | NASM `db` | **txt2bin** |
|---|:-:|:-:|:-:|:-:|
| Comments next to the bytes | ✗ | ~ | ✓ | ✓ |
| Lengths and offsets computed for you | ✗ | manual | ✓ | ✓ |
| Little- *and* big-endian, per section | ✗ | ✓ | ~ | ✓ |
| Text (UTF-8/16), hex, base64 in one place | ✗ | ~ | ~ | ✓ |
| Machine code for 30+ architectures | ✗ | ✗ | x86 only | ✓ |
| Readable diffs in code review | ✗ | ✓ | ✓ | ✓ |

## What people build with it

| | | example |
|---|---|---|
| **3D models** | A complete `.glb` (glTF) file, JSON chunk and vertex buffer included, with chunk sizes computed from labels. This is where txt2bin was born. | [`gltf-face.ttb`](exemplos/gltf-face.ttb) |
| **Media files** | A playable MIDI song. The same approach fits any format built from headers and length fields: WAV, BMP, PNG chunks… | [`midi.ttb`](exemplos/midi.ttb) |
| **Documents** | A valid one-page PDF. Its cross-reference table must list the byte offset of every object, written as decimal text; labels compute them, so you can edit the page freely. | [`pdf-minimo.ttb`](exemplos/pdf-minimo.ttb) |
| **Boot sectors** | 16-bit x86 code at `org=0x7c00`, padded to byte 510, then `55 AA`. Boot it in QEMU. | [`boot-x86.ttb`](exemplos/boot-x86.ttb) |
| **Microcontroller firmware** | AVR assembly that blinks an Arduino Uno's LED, written straight to Intel HEX for `avrdude`. | [`arduino-blink.ttb`](exemplos/arduino-blink.ttb) |
| **Lookup tables** | Sine tables, circle vertices, bit masks, computed in place with `sin`, `round` and friends. | [`expressoes.ttb`](exemplos/expressoes.ttb) |
| **Test fixtures** | Valid, almost-valid and deliberately broken inputs for your parser, readable in code review. | |

## Install

```sh
npm install -g txt2bin     # or: bun add -g txt2bin
txt2bin input.ttb output.bin
```

Or run it without installing: `npx txt2bin input.ttb output.bin` (or `bunx`). Requires Node.js 18+ or Bun. The `<<assembly` sections additionally need LLVM (see [Assembly](#assembly)); everything else has zero dependencies.

## A five-minute tour

A `.ttb` file is a list of **sections**. Each one starts with `<<directive` at the start of a line and says how the lines below it become bytes.

### 1. Bytes, text and numbers

```text
<<utf8
Hi!\n
<<hex
DE AD BE EF          # comments anywhere
<<uint16
1 2 0x7FFF           # little-endian by default
<<uint32+
0x89504E47           # add "+" for big-endian
```

```text
48 69 21 0a  de ad be ef  01 00 02 00 ff 7f  89 50 4e 47
```

### 2. Labels: never count bytes again

`<<@name` marks a position; `$name` is its offset. Labels can be used before they are defined, so length fields just work:

```text
<<uint32
$end-$start          # length of the block below, filled in for you
<<@start
<<utf8
{"asset":{"version":"2.0"}}
<<align 4 20         # pad with spaces to a multiple of 4
<<@end
```

Edit the JSON and the length updates itself. Sizes may depend on labels and labels on sizes (think `<<fill 510-($.-$start)`, or a jump whose encoding depends on its distance); txt2bin iterates the layout until it settles.

### 3. Math where you need it

```text
<<float32
(sin(pi/6))  (sqrt(2)/2)  1.5e-3
<<int8
round(127*sin(tau/16))  round(127*sin(2*tau/16))  round(127*sin(3*tau/16))
<<uint8
(1 << 5)  (0xF0 >> 4)  'A'  (0b1010 ^ 0b0110)
<<uint64
0xFFFF_FFFF_FFFF_FFFF  # integers are exact: no 64-bit precision loss
```

Python-style operators and precedence, `0x`/`0b`/`0o` literals, `_` separators, character literals and 25 math functions. Values are separated by spaces, so an expression that contains spaces goes in parentheses. Writing `1 + 2` bare is an error, not three silent values.

### 4. Machine code, inline

```text
<<@start
<<assembly(x86_16) org=0x7c00
    xor ax, ax
    mov ds, ax
    mov si, offset msg          ; Intel syntax, ";" comments
    mov ah, 0x0e                ; BIOS teletype output
next:
    lodsb
    test al, al
    jz done
    int 0x10
    jmp next
done:
    hlt
    jmp done
msg:
<<utf8
Hello from a text file!\r\n\0
<<fill 510-($.-$start)
<<uint16+
0x55AA
```

That is a complete, bootable x86 boot sector. `${expression}` drops values from the file into the assembly (`mov ecx, ${$end - $data}`), and `org=` accepts labels too.

### 5. Errors that point at the line

Every mistake is reported as `file:line: message`, including errors from the assembler, translated back to your source line: a value that doesn't fit its type, an undefined label, a stray `+`, a `-` inside standard base64 ("is this base64url?").

## Reference

### Directives

| directive | content | output |
|---|---|---|
| `<<utf8` | text; real line breaks are ignored | UTF-8 |
| `<<utf16` / `<<utf16+` | text | UTF-16 LE / BE |
| `<<hex` | hex digits; whitespace ignored | the bytes |
| `<<base64` / `<<base64url` | base64 (padding optional) | the bytes |
| `<<uint8` `<<int8` | values (expressions) | 1 byte each |
| `<<uint16` `<<int16` `<<float16` | values | 2 bytes each |
| `<<uint32` `<<int32` `<<float32` | values | 4 bytes each |
| `<<uint64` `<<int64` `<<float64` | values | 8 bytes each |
| `<<align N [HH]` | — | pads with byte `HH` (default `00`) to a multiple of `N` |
| `<<fill N [HH]` | — | `N` bytes of `HH`; `N` is an expression |
| `<<@name` | — | nothing; defines `$name` |
| `<<#` | anything | nothing (block comment) |
| `<<assembly(arch) [options]` | assembly code | machine code |

- **Byte order:** little-endian by default; append `+` for big-endian on any multi-byte type, including `utf16+`. Using `+` where byte order doesn't exist (`<<hex+`, `<<utf8+`) is an error, so nothing changes silently.
- **Comments:** `#` to end of line in `hex`, `base64` and numeric sections. In text sections `#` is text; use a `<<#` block instead.
- **Text escapes:** `\n \r \t \0 \\`, `\s` (a space you can see at end of line), `\<` (to start a line with `<<`), `\u{1F600}`.
- **Labels:** `$name` is the offset of `<<@name`; `$.` is the offset of the value being written.
- **Functions:** `sin cos tan asin acos atan atan2 sqrt cbrt exp log log2 log10 hypot rad deg abs min max floor ceil round trunc int float`. **Constants:** `pi tau e inf nan`.
- **Operators**, lowest to highest precedence: `|` `^` `&` `<< >>` `+ -` `* / // %` unary `- + ~` `**`. `/` is exact when it can be, `//` is floor division.

### Assembly

Assembly sections are assembled with **LLVM** (`llvm-mc`, plus `ld.lld` when relocations need resolving). Install it once:

| OS | command |
|---|---|
| macOS | `brew install llvm lld` |
| Debian/Ubuntu | `apt install llvm lld` |
| Windows | `winget install LLVM.LLVM` |

Supported out of the box: **x86** (16, 32, 64-bit; Intel or AT&T syntax), **ARM** (A32, Thumb-2, Cortex-M0/M3/M4/M33, AArch64, Apple Silicon), **AVR** (Arduino), **RISC-V** (32/64), **MIPS**, **PowerPC**, **SPARC**, **IBM Z**, **MSP430**, **Xtensa** (ESP32), **LoongArch**, **Hexagon**, **eBPF**, and any other LLVM target via `triple=`. Run `txt2bin --architectures` for the full list with aliases (`intel_x86`, `apple_silicon`, `arduino`…).

Options: `org=` (load address, defaults to the section's offset), `mcpu=` (e.g. `atmega328p`, `cortex-m7`, `apple-m3`), `mattr=` (e.g. `+avx2`), `triple=`, `syntax=intel|att`.

**Bring your own assembler.** For targets LLVM doesn't cover (Z80, 6502, 8051, PIC) or to use NASM, map a name to any command-line assembler that outputs raw binary in a `txt2bin.config.json` next to your file. See [`exemplos/txt2bin.config.json`](exemplos/txt2bin.config.json).

### Command line

```text
txt2bin input.ttb [output] [options]

  -o, --out FILE      output file ("-" for stdout)
  -f, --format FMT    bin | hex | base64 | base64url | datauri | ihex
  --mime TYPE         MIME type for datauri
  --map               print a map of sections and labels
  --config FILE       custom assembler backends
  --architectures     list assembly architectures and where LLVM was found
  --lang en|pt        message language (default: your system's)
```

`ihex` is Intel HEX, what `avrdude` and most microcontroller programmers expect. `datauri` gives you a `data:` URL ready to paste into HTML or a glTF `uri`.

### JavaScript / TypeScript API

```ts
import { assemble, format, map, isSourceError } from 'txt2bin';

try {
  const r = assemble(source);      // { bytes, rotulos, ... }
  r.bytes;                         // Uint8Array
  r.rotulos.get('end');            // label offsets (bigint)
  format(r.bytes, 'ihex');         // any CLI output format (a string, or bytes for 'bin')
  console.log(map(r));             // the --map table
} catch (e) {
  if (isSourceError(e)) console.error(`line ${e.linha}: ${e.message}`);
}
```

Messages follow your system language (English or Portuguese); call `setLanguage('en')` to pin it.

## Editor support

A **VS Code extension** lives in [`editores/vscode/`](editores/vscode/): syntax highlighting (assembly and expressions included), errors as you type, the offset and size of every section shown inline, label values on hover, go-to-definition, outline, snippets, and a button to generate the binary.

```sh
cd editores/vscode && bun install && bun run package
code --install-extension txt2bin-vscode-0.1.0.vsix
```

The grammar is standard TextMate, so it can be reused by other editors and highlighters.

## Good to know

- **Bilingual.** txt2bin was created in Brazil. Messages, help and the `--map` table come in English or Portuguese, following your system language (or `--lang` / `TXT2BIN_LANG`). The API has English names (`assemble`, `format`, `map`) next to the original Portuguese ones (`montar`, `formatar`, `mapa`); result fields such as `rotulos` (labels) are still Portuguese. The full language specification is in Portuguese in [`docs/especificacao.md`](docs/especificacao.md), and [`CONTEXTO.md`](CONTEXTO.md) explains every design decision.
- **Assembly needs LLVM**; everything else runs anywhere Node 18+ or Bun runs.

## Development

```sh
bun install
bun test              # assembly tests are skipped when LLVM is missing
bun run typecheck
bun run build         # dist/ for npm (Node 18+ and Bun)
bun run compile       # single-file executable in dist/txt2bin
```
