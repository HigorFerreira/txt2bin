# Changelog

## 0.3.1

- New Marketplace page: a tour of the txt2bin language, examples of what you can build, a directive summary and how to compile from the command line.
- The extension description is now in English.

## 0.3.0

- First release on the Visual Studio Marketplace.
- Extension icon, plus a file icon for `.ttb` files (light and dark variants).
- MIT license included in the package.

## 0.2.1

- Fix: a line with only `<<` or `<<@`, common while typing, no longer breaks the Outline view.

## 0.2.0

- Bundles txt2bin converter 0.4.0: `<<decimal` and `<<octal` sections, with highlighting.
- Converter messages follow VS Code's display language (English or Portuguese).

## 0.1.0

- First version: syntax highlighting for `.ttb` files, errors as you type (including assembler errors), offset and size at the end of each `<<directive` line, hover on labels and directives, go to definition for `$labels`, Outline and breadcrumbs, commands to generate the binary file and show the section map and hex dump, and snippets.
