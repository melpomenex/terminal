/**
 * Command language v2 — formal lexer + AST parser.
 *
 * Replaces the monolithic `if (bare === '...')` ladder with a deterministic
 * tokenizer and structured parse tree. Command input forms:
 *
 *   "NVDA"                        -> instrument load
 *   "NVDA GP"                     -> instrument + mnemonic action
 *   "AAPL US EQUITY GP"           -> Bloomberg-style qualified instrument
 *   "QM"                          -> bare mnemonic (open panel)
 *   "WORKSPACE SAVE tech-setup"   -> COMMAND SUBCOMMAND args…
 *   "ALERT AAPL ABOVE 200"        -> COMMAND <target> <predicate args>
 *   "AAPL 260515 C 200"           -> options contract instrument
 */

import type { InstrumentRef } from '@/lib/types/instrument';
import { securityMasterResolver } from '@/lib/security-master/resolver';

// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

export type TokenType = 'WORD' | 'NUMBER' | 'GO';

export interface Token {
  type: TokenType;
  value: string;
}

const GO_SUFFIX_RE = /\s*(?:<GO>|GO)$/i;

/** Tokenize raw command input, stripping optional `<GO>` / `GO` suffixes. */
export function tokenize(input: string): Token[] {
  const stripped = input.trim().replace(GO_SUFFIX_RE, '').trim();
  if (!stripped) return [];
  return stripped.split(/\s+/).map((value) => ({
    type: /^-?\d+(?:\.\d+)?$/.test(value) ? 'NUMBER' : 'WORD',
    value: value.toUpperCase(),
  }));
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

export type CommandAst =
  | { kind: 'INSTRUMENT'; instrument: InstrumentRef; mnemonic?: string; raw: string }
  | { kind: 'COMMAND'; mnemonic: string; subcommand?: string; args: string[]; target?: InstrumentRef; raw: string }
  | { kind: 'EMPTY'; raw: string };

/** Bloomberg-style qualification words stripped before symbol resolution. */
const QUALIFIERS = new Set(['US', 'EU', 'EQUITY', 'CURNCY', 'COMDTY', 'INDEX', 'GOVT', 'CORP', 'CMDTY']);

/**
 * Parse token stream into an AST.
 *
 * @param knownMnemonics registry keys + aliases, so "WORKSPACE SAVE x" is
 *        parsed as a command even though "WORKSPACE" could look like a ticker.
 */
export function parseCommand(input: string, knownMnemonics: Set<string>): CommandAst {
  const tokens = tokenize(input);
  if (tokens.length === 0) return { kind: 'EMPTY', raw: input };

  const first = tokens[0];
  const rest = tokens.slice(1);

  // Leading mnemonic: "QM", "GP NVDA" is NOT allowed (mnemonic-first with
  // symbol second is legacy; we accept "GP" alone and "NVDA GP").
  if (first.type === 'WORD' && knownMnemonics.has(first.value) && !looksLikeQualifiedInstrument(tokens)) {
    const sub = rest[0]?.type === 'WORD' && !knownMnemonics.has(rest[0].value) && isSubcommandWord(rest[0].value)
      ? rest[0].value
      : undefined;
    const argTokens = sub ? rest.slice(1) : rest;
    // Detect an instrument target among args (e.g. "FLNG AAPL", "TRAN NVDA")
    const target = argTokens.find((t) => t.type === 'WORD' && !QUALIFIERS.has(t.value) && t.value.length <= 10 && securityMasterResolver.resolve(t.value))
      ? securityMasterResolver.resolve(
          (argTokens.find((t) => t.type === 'WORD' && !QUALIFIERS.has(t.value) && t.value.length <= 10 && securityMasterResolver.resolve(t.value)) as Token).value,
        ) ?? undefined
      : undefined;
    return {
      kind: 'COMMAND',
      mnemonic: first.value,
      subcommand: sub,
      args: argTokens.map((t) => t.value),
      target,
      raw: input,
    };
  }

  // Instrument-first: "NVDA", "NVDA GP", "AAPL US EQUITY GP", "AAPL 260515 C 200"
  const instrumentWords: Token[] = [];
  let mnemonic: string | undefined;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'WORD' && knownMnemonics.has(t.value) && i > 0) {
      mnemonic = t.value;
      // Everything after the mnemonic belongs to it (rare; e.g. "NVDA IND SMA")
      break;
    }
    instrumentWords.push(t);
  }

  // Try progressively longer prefixes as the instrument (options strings need
  // several tokens: "AAPL 260515 C 200").
  for (let len = instrumentWords.length; len >= 1; len--) {
    const candidate = instrumentWords.slice(0, len).map((t) => t.value).join(' ');
    const ref = securityMasterResolver.resolve(candidate);
    if (ref) {
      const trailing = instrumentWords.slice(len).map((t) => t.value);
      const trailingOk = trailing.length === 0 || trailing.every((w) => QUALIFIERS.has(w) || knownMnemonics.has(w));
      if (!trailingOk && tokens.length > 1) {
        // Words the instrument path can't explain ("WORKSPACEE SAVE x") —
        // fall through to the unknown-command path for suggestion handling.
        break;
      }
      return { kind: 'INSTRUMENT', instrument: ref, mnemonic, raw: input, ...(trailing.length ? { trailing } : {}) } as CommandAst;
    }
  }

  // Unknown single word — treat as a raw command attempt so the registry can
  // surface a helpful error / closest-match suggestion.
  return { kind: 'COMMAND', mnemonic: first.value, args: rest.map((t) => t.value), raw: input };
}

function looksLikeQualifiedInstrument(tokens: Token[]): boolean {
  // "AAPL US EQUITY" — first token resolves as instrument and rest are qualifiers
  if (tokens.length < 2) return false;
  const firstResolves = securityMasterResolver.resolve(tokens[0].value) != null;
  const restAreQualifiers = tokens.slice(1).every((t) => QUALIFIERS.has(t.value));
  return firstResolves && restAreQualifiers;
}

function isSubcommandWord(word: string): boolean {
  // Subcommands are common verbs used by multi-word commands.
  return ['SAVE', 'LOAD', 'DELETE', 'LIST', 'CREATE', 'RENAME', 'IMPORT', 'EXPORT', 'SET', 'SHOW', 'CLEAR'].includes(word);
}

/** Suggest closest registry mnemonic by edit distance (help + typos). */
export function suggestMnemonic(input: string, candidates: string[]): string | null {
  let best: { word: string; dist: number } | null = null;
  for (const c of candidates) {
    const dist = levenshtein(input.toUpperCase(), c);
    if (!best || dist < best.dist) best = { word: c, dist };
  }
  return best && best.dist <= Math.max(2, Math.floor(best.word.length / 3)) ? best.word : null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}
