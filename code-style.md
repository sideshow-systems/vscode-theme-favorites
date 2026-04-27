# Code Style Guide

This document defines the coding standards for this project. All contributors and AI agents must follow these rules.

## Indentation & Whitespace

- **Use tabs**, never spaces
- Tab width: 4
- No trailing whitespace
- Always end files with a newline

## TypeScript

- Use `const` by default; use `let` only when reassignment is needed; never use `var`
- Always declare explicit types for function parameters and return values
- Prefix private class fields with an underscore: `_myField`
- Prefer `interface` over `type` for object shapes; use `type` for unions/intersections
- Use `readonly` for properties that are never reassigned
- Avoid `any`; use `unknown` when the type is truly unknown
- Use optional chaining (`?.`) and nullish coalescing (`??`) over manual null checks
- Enable and respect strict TypeScript (`"strict": true` in tsconfig)

## Strings & Quotes

- Single quotes `'` for all strings
- Template literals for string interpolation — no concatenation with `+`

## Formatting

- Semicolons at the end of every statement
- Trailing commas in multi-line arrays, objects, and function parameters (ES5 style)
- Opening braces on the same line (`bracketSameLine: true`)
- Arrow function parentheses always: `(x) => x` not `x => x`
- Maximum line width: 100 characters

## Functions & Classes

- Prefer arrow functions for callbacks and short expressions
- Prefer `async/await` over raw Promise chains
- Keep functions focused — one responsibility per function
- Use `readonly` arrays (`readonly T[]`) when the array is not mutated

## Imports

- Group imports: external packages first, then internal modules, separated by a blank line
- No unused imports
- Use named imports over default imports when both are available

## Comments

- Write comments only when the _why_ is non-obvious
- No commented-out code in commits
- JSDoc for public API functions only

## JSON & YAML

- JSON: 1-tab indentation (tabs), follow Prettier defaults
- YAML: 2-space indentation (exception to the tab rule — YAML spec requires spaces)

## Naming

- `camelCase` for variables, functions, and methods
- `PascalCase` for classes, interfaces, types, and enums
- `SCREAMING_SNAKE_CASE` for top-level constants that are truly constant
- Prefixing private members: `_myPrivateField`

## Enforcement

- Prettier (`npm run format`) formats all files automatically
- Save-on-format is enabled in `.vscode/settings.json`
- EditorConfig (`.editorconfig`) ensures consistent whitespace across editors
