import { Parser, Language, Query } from 'web-tree-sitter';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Standard VSCode semantic token types — themes style these automatically
const TOKEN_TYPES = [
  'comment',       // 0  comments, stubs
  'keyword',       // 1  control flow: ^return, ?try, (||) match, {||} iter
  'string',        // 2  string literals
  'number',        // 3  numeric literals
  'operator',      // 4  binary ops, comparison, logical, range
  'type',          // 5  type references (PascalCase in expressions)
  'class',         // 6  type definitions (domain_decl, struct_decl names)
  'interface',     // 7  trait names (camelCase declarations + impls)
  'enumMember',    // 8  variants / constructors
  'function',      // 9  method definitions (trait_method_sig, impl_member)
  'method',        // 10 method calls / access (camelCase after .)
  'parameter',     // 11 @param definitions
  'variable',      // 12 instance references (@Name use)
  'property',      // 13 struct fields, field access (PascalCase after .)
  'namespace',     // 14 modules
  'macro',         // 15 builtins: Main, StdOut, StdErr
  'decorator',     // 16 sigils: @ : ~ $ & ^
  'label',         // 17 labels: 'name
  'regexp',        // 18 brackets, delimiters, punctuation
];

const TOKEN_MODIFIERS = [
  'declaration',     // 0  definitions (domain, struct, trait, method names)
  'definition',      // 1  type definitions
  'readonly',        // 2  constants (!Name)
  'defaultLibrary',  // 3  built-in types (U32, Vec, Self, etc.)
  'modification',    // 4  mutable operations (~)
];

const legend = new vscode.SemanticTokensLegend(TOKEN_TYPES, TOKEN_MODIFIERS);

// Modifier bit flags
const MOD_DECLARATION    = 1 << 0;
const MOD_DEFINITION     = 1 << 1;
const MOD_READONLY       = 1 << 2;
const MOD_DEFAULT_LIB    = 1 << 3;
const MOD_MODIFICATION   = 1 << 4;

// Map tree-sitter @captures → [tokenTypeIndex, modifierBitmask]
const CAPTURE_MAP: Record<string, [number, number]> = {
  // Comments
  'comment':              [0, 0],
  'comment.unused':       [0, 0],

  // Keywords / control
  'keyword':              [1, 0],
  'keyword.control':      [1, 0],
  'keyword.return':       [1, 0],

  // Strings
  'string':               [2, 0],
  'string.escape':        [2, MOD_READONLY],
  'string.special':       [2, MOD_MODIFICATION],

  // Numbers
  'number':               [3, 0],
  'number.float':         [3, 0],

  // Constants
  'constant':             [3, MOD_READONLY],
  'constant.builtin':     [3, MOD_READONLY | MOD_DEFAULT_LIB],

  // Operators
  'operator':             [4, 0],
  'operator.comparison':  [4, 0],
  'operator.logical':     [4, 0],

  // Type references (PascalCase in expressions)
  'type':                 [5, 0],
  'type.builtin':         [5, MOD_DEFAULT_LIB],
  'type.definition':      [6, MOD_DECLARATION | MOD_DEFINITION],
  'type.interface':       [7, 0],

  // Variants / constructors
  'constructor':          [8, 0],

  // Module
  'module':               [14, 0],
  'module.definition':    [14, MOD_DECLARATION | MOD_DEFINITION],

  // Type parameter ($Value, $Clone&Debug)
  'type.parameter':       [5, MOD_DECLARATION],

  // Functions / methods
  'function':             [9, MOD_DECLARATION],
  'function.builtin':     [15, MOD_DEFAULT_LIB],
  'function.method':      [10, 0],
  'function.method.call': [10, 0],

  // Variables
  'variable':             [12, 0],
  'variable.definition':  [12, MOD_DECLARATION | MOD_DEFINITION],
  'variable.parameter':   [11, MOD_DECLARATION],
  'variable.builtin':     [12, MOD_DEFAULT_LIB],

  // Properties (struct fields, PascalCase field access)
  'property':             [13, 0],

  // Sigils / punctuation.special → decorator
  'punctuation.special':  [16, 0],

  // Brackets / delimiters
  'punctuation.bracket':    [18, 0],
  'punctuation.delimiter':  [18, 0],

  // Error / stub
  'error':                [0, 0],

  // Labels
  'label':                [17, 0],
};

function resolveCapture(name: string): [number, number] | null {
  const clean = name.startsWith('@') ? name.slice(1) : name;

  let key = clean;
  while (key) {
    const entry = CAPTURE_MAP[key];
    if (entry !== undefined) return entry;
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

    // Skip query lines referencing node types absent in this grammar version
    let attempts = 0;
    while (attempts < 50) {
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
        const resolved = resolveCapture(capture.name);
        if (resolved === null) continue;

        const [typeIdx, modBits] = resolved;
        const node = capture.node;
        const startLine = node.startPosition.row;
        const startChar = node.startPosition.column;
        const endLine = node.endPosition.row;
        const endChar = node.endPosition.column;

        if (startLine === endLine) {
          builder.push(startLine, startChar, endChar - startChar, typeIdx, modBits);
        } else {
          const firstLen = document.lineAt(startLine).text.length - startChar;
          builder.push(startLine, startChar, firstLen, typeIdx, modBits);
          for (let line = startLine + 1; line < endLine; line++) {
            builder.push(line, 0, document.lineAt(line).text.length, typeIdx, modBits);
          }
          if (endChar > 0) {
            builder.push(endLine, 0, endChar, typeIdx, modBits);
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
