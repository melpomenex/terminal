import { describe, it, expect } from 'vitest';
import { tokenize, parseCommand, suggestMnemonic } from '@/lib/commands/command-parser';
import { commandRegistry, createDefaultRegistry } from '@/lib/commands/command-registry';

const tokens = commandRegistry.matchableTokens();

describe('command lexer', () => {
  it('splits words and classifies numbers', () => {
    const ts = tokenize('ALERT AAPL ABOVE 200.50');
    expect(ts.map((t) => t.value)).toEqual(['ALERT', 'AAPL', 'ABOVE', '200.50']);
    expect(ts[3].type).toBe('NUMBER');
    expect(ts[0].type).toBe('WORD');
  });

  it('strips <GO> and GO suffixes', () => {
    expect(tokenize('AAPL <GO>').length).toBe(1);
    expect(tokenize('QM GO')[0].value).toBe('QM');
  });

  it('returns empty for empty input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('command AST parser', () => {
  it('parses a bare ticker as an INSTRUMENT node', () => {
    const ast = parseCommand('NVDA', tokens);
    expect(ast.kind).toBe('INSTRUMENT');
    if (ast.kind === 'INSTRUMENT') {
      expect(ast.instrument.symbol).toBe('NVDA');
      expect(ast.mnemonic).toBeUndefined();
    }
  });

  it('parses "NVDA GP" as instrument + mnemonic', () => {
    const ast = parseCommand('NVDA GP', tokens);
    expect(ast.kind).toBe('INSTRUMENT');
    if (ast.kind === 'INSTRUMENT') {
      expect(ast.instrument.symbol).toBe('NVDA');
      expect(ast.mnemonic).toBe('GP');
    }
  });

  it('parses Bloomberg-qualified instruments', () => {
    const ast = parseCommand('AAPL US EQUITY', tokens);
    expect(ast.kind).toBe('INSTRUMENT');
    if (ast.kind === 'INSTRUMENT') expect(ast.instrument.symbol).toBe('AAPL');
  });

  it('parses an option contract string', () => {
    const ast = parseCommand('AAPL 260515 C 200', tokens);
    expect(ast.kind).toBe('INSTRUMENT');
    if (ast.kind === 'INSTRUMENT') expect(ast.instrument.assetClass).toBe('OPTION');
  });

  it('parses COMMAND with subcommand and args (WORKSPACE SAVE x)', () => {
    const ast = parseCommand('WORKSPACE SAVE tech-setup', tokens);
    expect(ast.kind).toBe('COMMAND');
    if (ast.kind === 'COMMAND') {
      expect(ast.mnemonic).toBe('WORKSPACE');
      expect(ast.subcommand).toBe('SAVE');
      expect(ast.args).toEqual(['TECH-SETUP']);
    }
  });

  it('extracts an instrument target from "FLNG AAPL"', () => {
    const ast = parseCommand('FLNG AAPL', tokens);
    expect(ast.kind).toBe('COMMAND');
    if (ast.kind === 'COMMAND') {
      expect(ast.mnemonic).toBe('FLNG');
      expect(ast.target?.symbol).toBe('AAPL');
    }
  });

  it('unknown bare words fall back to the ticker path (INSTRUMENT)', () => {
    // Legacy behavior: any 1-10 letter uppercase word loads as a symbol.
    const ast = parseCommand('QMM', tokens);
    expect(ast.kind).toBe('INSTRUMENT');
  });

  it('unknown multi-word commands surface as COMMAND nodes for suggestions', () => {
    const ast = parseCommand('WORKSPACEE SAVE x', tokens);
    expect(ast.kind).toBe('COMMAND');
    if (ast.kind === 'COMMAND') expect(ast.mnemonic).toBe('WORKSPACEE');
  });

  it('parses the HELP mnemonic', () => {
    const ast = parseCommand('HELP', tokens);
    expect(ast.kind).toBe('COMMAND');
  });
});

describe('command registry', () => {
  const registry = createDefaultRegistry();

  it('resolves aliases to canonical definitions', () => {
    const l2 = registry.get('L2');
    const depth = registry.get('DEPTH');
    const book = registry.get('BOOK');
    expect(l2?.mnemonic).toBe('L2');
    expect(depth?.mnemonic).toBe('L2');
    expect(book?.mnemonic).toBe('L2');
  });

  it('registers the full v2 tool surface (FA, RATIO, EM, TRAN, ALLQ, OVME, CALC, WORKSPACE, COMPARE)', () => {
    for (const m of ['FA', 'RATIO', 'EM', 'TRAN', 'ALLQ', 'OVME', 'CALC', 'WORKSPACE', 'COMPARE', 'HALT', 'IPO', 'NOTE', 'SECF', 'AUM', 'HP']) {
      expect(registry.get(m), m).toBeDefined();
    }
  });

  it('category groupings cover every registered command', () => {
    const byCat = registry.byCategory();
    const grouped = Object.values(byCat).reduce((s, arr) => s + arr.length, 0);
    expect(grouped).toBe(registry.all().length);
  });

  it('panel-opening commands carry a target panel type', () => {
    expect(registry.get('FA')?.targetPanelType).toBe('financial-analysis');
    expect(registry.get('TRAN')?.targetPanelType).toBe('transcripts');
    expect(registry.get('WORKSPACE')?.targetPanelType).toBe('workspace-manager');
  });
});

describe('mnemonic suggestion', () => {
  it('suggests near-miss mnemonics', () => {
    expect(suggestMnemonic('QMM', [...tokens])).toBe('QM');
    expect(suggestMnemonic('TAEP', [...tokens])).toBe('TAPE');
  });

  it('returns null for gibberish', () => {
    expect(suggestMnemonic('ZZZZZZZZZ', [...tokens])).toBeNull();
  });
});
