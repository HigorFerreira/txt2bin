# Changelog

## 0.3.0

- Messages, help and the `--map` table in **English and Portuguese**. The language follows `--lang`, the `TXT2BIN_LANG` variable or the system locale (Portuguese for `pt*`, English otherwise).
- `--architectures` as an alias of `--arquiteturas`, with English descriptions.
- English API names next to the Portuguese ones: `assemble`, `format`, `map`, `SourceError`, `isSourceError`, `setLanguage`, `language`, `Options`, `Result`, `FORMATS`.
- `definirIdioma()`, `idioma()` and `detectarIdioma()` exported.
- VS Code extension: converter messages follow VS Code's display language.

## 0.2.0

First npm release: plain-text `.ttb` files with hex, text (UTF-8/16), base64, integers and floats in either byte order, expressions, self-resolving labels with fixed-point layout, `align`/`fill`, and inline assembly for 30+ architectures through LLVM or custom backends. Output as raw binary, hex, base64, data URI or Intel HEX.
