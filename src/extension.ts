import { Parser, Language, Query } from 'web-tree-sitter';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Token types — expanded to match Emacs face granularity
const TOKEN_TYPES = [
  'comment',     // 0  base03 — comments
  'keyword',     // 1  base0E — control flow, sigils @ : ~ ! ?
  'string',      // 2  base0B — string literals
  'number',      // 3  base09 — numbers, constants, variants
  'operator',    // 4  base0F — binary operators
  'type',        // 5  base0A — types, domains, modules, grammar
  'function',    // 6  base0D — functions, methods, traits
  'variable',    // 7  base05 — variable use (instance_ref)
  'parameter',   // 8  base08 — parameter defs, variable defs, struct names, properties
  'macro',       // 9  base0C — builtins (Main, StdOut, self), escapes
  'regexp',      // 10 base04 — punctuation, brackets
];

const TOKEN_MODIFIERS: string[] = [];

const legend = new vscode.SemanticTokensLegend(TOKEN_TYPES, TOKEN_MODIFIERS);

// Map tree-sitter captures → Emacs-equivalent token types
const CAPTURE_MAP: Record<string, number> = {
  // comment → base03
  'comment':              0,

  // keyword → base0E (control flow + sigils)
  'keyword':              1,
  'keyword.control':      1,
  'keyword.return':       1,
  'keyword.yield':        1,

  // string → base0B
  'string':               2,

  // number/constant → base09
  'number':               3,
  'number.float':         3,
  'constant':             3,
  'constant.builtin':     3,
  'constructor':          3,  // variants are constants in aski

  // operator → base0F
  'operator':             4,
  'operator.comparison':  4,
  'operator.logical':     4,

  // type → base0A (type, domain, module, grammar, preprocessor)
  'type':                 5,
  'type.builtin':         5,
  'type.definition':      5,
  'type.interface':       5,
  'module':               5,

  // function → base0D (function, method, trait)
  'function':             6,
  'function.builtin':     9,  // Main/StdOut → builtin (base0C)
  'function.method':      6,
  'function.method.call': 6,

  // variable → base05 (instance_ref use)
  'variable':             7,

  // parameter → base08 (definitions, struct names, properties)
  'variable.parameter':   8,
  'variable.builtin':     9,  // self, wildcard → builtin
  'property':             8,

  // builtin → base0C (Main, StdOut, escapes)
  'string.escape':        9,
  'string.special':       9,

  // punctuation → base04
  'punctuation.special':  1,  // sigils @ : ~ ! → keyword (base0E)
  'punctuation.bracket':  10,
  'punctuation.delimiter': 10,

  // error/stub → base08
  'error':                8,

  // label → base0A
  'label':                5,
};

function resolveCapture(name: string): number | null {
  const clean = name.startsWith('@') ? name.slice(1) : name;

  let key = clean;
  while (key) {
    const idx = CAPTURE_MAP[key];
    if (idx !== undefined) return idx;
    const dot = key.lastIndexOf('.');
    if (dot < 0) break;
    key = key.slice(0, dot);
  }
  return null;
}

class AskiTokensProvider implements vscode.DocumentSemanticTokensProvider {
  private parser: Parser | null = null;
  private query: Query | null = null;

  constructor(private extensionPath: string) {}

  async init(): Promise<void> {
    await Parser.init({
      locateFile: (_file: string) =>
        path.join(this.extensionPath, 'node_modules', 'web-tree-sitter', _file),
    });

    const wasmPath = path.join(this.extensionPath, 'grammars', 'tree-sitter-aski.wasm');
    if (!fs.existsSync(wasmPath)) {
      vscode.window.showErrorMessage(`Aski: grammar WASM not found at ${wasmPath}`);
      return;
    }

    const language = await Language.load(wasmPath);
    this.parser = new Parser();
    this.parser.setLanguage(language);

    const queryPath = path.join(this.extensionPath, 'queries', 'highlights.scm');
    if (!fs.existsSync(queryPath)) {
      vscode.window.showErrorMessage(`Aski: highlights.scm not found at ${queryPath}`);
      return;
    }

    let querySource = fs.readFileSync(queryPath, 'utf-8');

    // Remove lines with node types not in this grammar version
    let attempts = 0;
    while (attempts < 20) {
      try {
        this.query = new Query(language, querySource);
        break;
      } catch (e: any) {
        if (e.index !== undefined) {
          const before = querySource.substring(0, e.index);
          const lineStart = before.lastIndexOf('\n') + 1;
          const lineEnd = querySource.indexOf('\n', e.index);
          querySource = querySource.substring(0, lineStart) +
            ';; skipped\n' +
            (lineEnd > 0 ? querySource.substring(lineEnd + 1) : '');
          attempts++;
        } else {
          vscode.window.showErrorMessage(`Aski: query error: ${e.message}`);
          return;
        }
      }
    }
  }

  provideDocumentSemanticTokens(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.SemanticTokens | null {
    if (!this.parser || !this.query) return null;

    const tree = this.parser.parse(document.getText());
    const matches = this.query.matches(tree.rootNode);
    const builder = new vscode.SemanticTokensBuilder(legend);

    for (const match of matches) {
      for (const capture of match.captures) {
        const typeIdx = resolveCapture(capture.name);
        if (typeIdx === null) continue;

        const node = capture.node;
        const startLine = node.startPosition.row;
        const startChar = node.startPosition.column;
        const endLine = node.endPosition.row;
        const endChar = node.endPosition.column;

        if (startLine === endLine) {
          builder.push(startLine, startChar, endChar - startChar, typeIdx, 0);
        } else {
          const firstLen = document.lineAt(startLine).text.length - startChar;
          builder.push(startLine, startChar, firstLen, typeIdx, 0);
          for (let line = startLine + 1; line < endLine; line++) {
            builder.push(line, 0, document.lineAt(line).text.length, typeIdx, 0);
          }
          if (endChar > 0) {
            builder.push(endLine, 0, endChar, typeIdx, 0);
          }
        }
      }
    }

    return builder.build();
  }
}

export async function activate(context: vscode.ExtensionContext) {
  const provider = new AskiTokensProvider(context.extensionPath);
  await provider.init();

  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: 'aski' },
      provider,
      legend
    )
  );
}

export function deactivate() {}
