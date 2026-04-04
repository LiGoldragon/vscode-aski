import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Parser from 'web-tree-sitter';

const TOKEN_TYPES = [
  'comment', 'keyword', 'string', 'number', 'operator',
  'type', 'interface', 'function', 'method', 'variable',
  'parameter', 'property', 'label', 'decorator', 'regexp',
  'enumMember',
];

const TOKEN_MODIFIERS = ['definition', 'builtin'];

const legend = new vscode.SemanticTokensLegend(TOKEN_TYPES, TOKEN_MODIFIERS);

// Map tree-sitter @capture names to [tokenType, ...modifiers]
const CAPTURE_MAP: Record<string, [string, ...string[]]> = {
  'comment':              ['comment'],
  'keyword':              ['keyword'],
  'keyword.control':      ['keyword'],
  'keyword.return':       ['keyword'],
  'keyword.yield':        ['keyword'],
  'string':               ['string'],
  'string.escape':        ['regexp'],
  'string.special':       ['regexp'],
  'number':               ['number'],
  'number.float':         ['number'],
  'operator':             ['operator'],
  'operator.comparison':  ['operator'],
  'operator.logical':     ['operator'],
  'type':                 ['type'],
  'type.builtin':         ['type', 'builtin'],
  'type.definition':      ['type', 'definition'],
  'type.interface':       ['interface'],
  'function':             ['function'],
  'function.builtin':     ['function', 'builtin'],
  'function.method':      ['method'],
  'function.method.call': ['method'],
  'variable':             ['variable'],
  'variable.builtin':     ['variable', 'builtin'],
  'variable.parameter':   ['parameter'],
  'property':             ['property'],
  'constructor':          ['enumMember'],
  'constant':             ['number'],
  'constant.builtin':     ['number', 'builtin'],
  'label':                ['label'],
  'module':               ['type'],
  'error':                ['regexp'],
  'punctuation.special':  ['decorator'],
  'punctuation.bracket':  ['operator'],
  'punctuation.delimiter': ['operator'],
};

function resolveCapture(name: string): [number, number] | null {
  const clean = name.startsWith('@') ? name.slice(1) : name;

  // Try exact match first, then progressively shorter prefixes
  let key = clean;
  while (key) {
    const entry = CAPTURE_MAP[key];
    if (entry) {
      const [typeName, ...mods] = entry;
      const typeIdx = TOKEN_TYPES.indexOf(typeName);
      if (typeIdx < 0) return null;
      let modBits = 0;
      for (const m of mods) {
        const mi = TOKEN_MODIFIERS.indexOf(m);
        if (mi >= 0) modBits |= 1 << mi;
      }
      return [typeIdx, modBits];
    }
    const dot = key.lastIndexOf('.');
    if (dot < 0) break;
    key = key.slice(0, dot);
  }
  return null;
}

class AskiTokensProvider implements vscode.DocumentSemanticTokensProvider {
  private parser: Parser | null = null;
  private query: Parser.Query | null = null;

  constructor(private extensionPath: string) {}

  async init(): Promise<void> {
    const treeSitterWasm = path.join(
      this.extensionPath, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm'
    );
    await Parser.init({
      locateFile: () => treeSitterWasm,
    });
    this.parser = new Parser();

    const wasmPath = path.join(this.extensionPath, 'grammars', 'tree-sitter-aski.wasm');
    if (!fs.existsSync(wasmPath)) {
      vscode.window.showErrorMessage(`Aski: grammar WASM not found at ${wasmPath}`);
      return;
    }

    const language = await Parser.Language.load(wasmPath);
    this.parser.setLanguage(language);

    const queryPath = path.join(this.extensionPath, 'queries', 'highlights.scm');
    if (!fs.existsSync(queryPath)) {
      vscode.window.showErrorMessage(`Aski: highlights.scm not found at ${queryPath}`);
      return;
    }

    const querySource = fs.readFileSync(queryPath, 'utf-8');
    this.query = language.query(querySource);
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
        if (!resolved) continue;

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
