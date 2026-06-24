import { v4 as uuid } from 'uuid';
import { Block, ElifBranch, Variable, PythonType, ListItem, DictEntry, ConditionExpr, ConditionClause, CompareOp } from '../types';

export interface ParseResult {
  blocks: Block[];
  variables: Omit<Variable, 'id'>[];
  skipped: string[];
}

// ── Low-level string helpers ───────────────────────────────────────────────────

/** Net bracket depth of a string (ignoring string literals). Positive = unclosed opens. */
function netDepth(s: string): number {
  let d = 0, inStr = false, q = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === q) inStr = false;
    } else if (c === '"' || c === "'") { inStr = true; q = c; }
    else if ('([{'.includes(c)) d++;
    else if (')]}'.includes(c)) d--;
  }
  return d;
}

/** Split by top-level commas (not inside brackets or strings). */
function splitArgs(s: string): string[] {
  const parts: string[] = [];
  let d = 0, inStr = false, q = '', start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === q) inStr = false;
    } else if (c === '"' || c === "'") { inStr = true; q = c; }
    else if ('([{'.includes(c)) d++;
    else if (')]}'.includes(c)) d--;
    else if (c === ',' && d === 0) { parts.push(s.slice(start, i).trim()); start = i + 1; }
  }
  const tail = s.slice(start).trim();
  if (tail) parts.push(tail);
  return parts.filter(Boolean);
}

/** Strip surrounding single or double quotes. Return unchanged if not quoted. */
function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t[0] === t[t.length - 1] && (t[0] === '"' || t[0] === "'"))
    return t.slice(1, -1);
  return t;
}

// ── Condition string → ConditionExpr ─────────────────────────────────────────

const COMPARE_OPS_ORDERED: CompareOp[] = ['not in', 'in', '>=', '<=', '==', '!=', '>', '<'];

/** Split a top-level Python expression by `and`/`or` word boundaries. */
function splitByLogic(s: string): { parts: string[]; joiners: ('and' | 'or')[] } {
  // Tokenise, splitting at word-boundary `and` / `or`
  const tokens = s.split(/\b(and|or)\b/);
  const parts: string[]           = [];
  const joiners: ('and' | 'or')[] = [];
  tokens.forEach((t, i) => {
    if (i % 2 === 0) { parts.push(t.trim()); }
    else              { joiners.push(t.trim() as 'and' | 'or'); }
  });
  return { parts, joiners };
}

function parseClause(s: string): ConditionClause {
  let p = s.trim();
  let notFlag = false;

  // not (expr)
  if (/^not\s*\(/.test(p) && p.endsWith(')')) {
    notFlag = true;
    p = p.replace(/^not\s*\(/, '').slice(0, -1).trim();
  }
  // `not expr` (no parens) → treat as `not is`
  else if (/^not\s+/.test(p)) {
    return { not: true, left: p.slice(4).trim(), op: 'is', right: '' };
  }

  for (const op of COMPARE_OPS_ORDERED) {
    // regex: (.+?) <op> (.+) — greedy right side
    const re = new RegExp(`^(.+?)\\s+${op.replace(' ', '\\s+')}\\s+(.+)$`);
    const m  = p.match(re);
    if (m) return { not: notFlag, left: m[1].trim(), op, right: m[2].trim() };
  }

  // No operator found — plain truthiness check
  return { not: notFlag, left: p, op: 'is', right: '' };
}

/** Convert a Python condition string to JSON-serialised ConditionExpr. */
function conditionStrToJson(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) {
    const empty: ConditionExpr = { clauses: [{ not: false, left: '', op: 'is', right: '' }], joiners: [] };
    return JSON.stringify(empty);
  }
  const { parts, joiners } = splitByLogic(trimmed);
  const clauses: ConditionClause[] = parts.map(parseClause);
  return JSON.stringify({ clauses, joiners } as ConditionExpr);
}

// ─────────────────────────────────────────────────────────────────────────────

/** Parse a `key=val, key=val` kwargs string into a Record. */
function parseKwargs(s: string): Record<string, string> {
  const r: Record<string, string> = {};
  for (const seg of splitArgs(s)) {
    const eq = seg.indexOf('=');
    if (eq === -1) continue;
    r[seg.slice(0, eq).trim()] = seg.slice(eq + 1).trim();
  }
  return r;
}

/** Map a type annotation token to a PythonType. */
function toType(t: string): PythonType {
  const map: Record<string, PythonType> = {
    str: 'str', int: 'int', float: 'float', bool: 'bool',
    list: 'list', dict: 'dict', None: 'None',
  };
  return map[t.trim()] ?? 'Any';
}

/** Parse a Python list literal into ListItems. */
function parseListLiteral(src: string): ListItem[] {
  const inner = src.trim().slice(1, -1).trim();
  if (!inner) return [];
  return splitArgs(inner).map((item): ListItem => {
    const v = item.trim();
    if (v === 'True' || v === 'False') return { type: 'bool', value: v };
    if (/^-?\d+$/.test(v)) return { type: 'int', value: v };
    if (/^-?(\d+\.\d*|\d*\.\d+)$/.test(v)) return { type: 'float', value: v };
    return { type: 'str', value: unquote(v) };
  });
}

/** Parse a Python dict literal into DictEntries. */
function parseDictLiteral(src: string): DictEntry[] {
  const inner = src.trim().slice(1, -1).trim();
  if (!inner) return [];
  return splitArgs(inner).flatMap((pair): DictEntry[] => {
    const ci = pair.indexOf(':');
    if (ci === -1) return [];
    const key = unquote(pair.slice(0, ci).trim());
    const val = pair.slice(ci + 1).trim();
    if (val === 'True' || val === 'False') return [{ key, valueType: 'bool', value: val }];
    if (/^-?\d+$/.test(val)) return [{ key, valueType: 'int', value: val }];
    if (/^-?(\d+\.\d*|\d*\.\d+)$/.test(val)) return [{ key, valueType: 'float', value: val }];
    return [{ key, valueType: 'str', value: unquote(val) }];
  });
}

/** Decompose a Python value string into Variable storage fields. */
function parseValue(type: PythonType, src: string): Pick<Variable, 'value' | 'items' | 'entries'> {
  const v = src.trim();
  switch (type) {
    case 'str':   return { value: unquote(v), items: [], entries: [] };
    case 'int':
    case 'float':
    case 'bool':
    case 'Any':   return { value: v, items: [], entries: [] };
    case 'None':  return { value: 'None', items: [], entries: [] };
    case 'list':  return { value: '', items: parseListLiteral(v), entries: [] };
    case 'dict':  return { value: '', items: [], entries: parseDictLiteral(v) };
    default:      return { value: v, items: [], entries: [] };
  }
}

// ── Logical line builder ───────────────────────────────────────────────────────

interface LLine { indent: number; text: string }

/** Join physical lines into logical lines, handling backslash and open-bracket continuation. */
function buildLogicalLines(code: string): LLine[] {
  const raw = code.split('\n');
  const result: LLine[] = [];
  let i = 0;
  while (i < raw.length) {
    const line = raw[i];
    const stripped = line.trimStart();
    if (!stripped) {
      result.push({ indent: 0, text: '' });
      i++;
      continue;
    }
    if (stripped.startsWith('#')) {
      result.push({ indent: line.length - stripped.length, text: stripped.trimEnd() });
      i++;
      continue;
    }
    const indent = line.length - stripped.length;
    let text = stripped.trimEnd();
    while (text.endsWith('\\') || netDepth(text) > 0) {
      if (text.endsWith('\\')) text = text.slice(0, -1).trimEnd();
      i++;
      if (i >= raw.length) break;
      text += ' ' + raw[i].trim();
    }
    result.push({ indent, text });
    i++;
  }
  return result;
}

// ── Block parser ───────────────────────────────────────────────────────────────

function mkBlock(
  type: Block['type'],
  params: Record<string, string>,
  children: Block[] = [],
  elseChildren: Block[] = [],
  elifBranches: ElifBranch[] = [],
): Block {
  return { id: uuid(), type, params, children, elseChildren, elifBranches };
}

/** Parse an indented group of lines starting at `from` with `baseIndent`. */
function parseGroup(lines: LLine[], from: number, baseIndent: number): { blocks: Block[]; next: number } {
  const blocks: Block[] = [];
  let i = from;

  while (i < lines.length) {
    const { indent, text } = lines[i];
    if (!text) { i++; continue; }
    if (indent < baseIndent) break;
    if (indent > baseIndent) { i++; continue; } // orphaned deeper line

    if (text === 'pass' || /^(import |from )/.test(text)) { i++; continue; }

    // ── Comment: # some text
    if (text.startsWith('#')) {
      blocks.push(mkBlock('comment', { text: text.slice(1).trim() }));
      i++; continue;
    }

    // ── HTTP request: varName = requests.request(method=..., url=..., ...)
    const httpM = text.match(/^(\w+)\s*=\s*requests\.request\((.+)\)$/s);
    if (httpM) {
      const kw = parseKwargs(httpM[2]);
      blocks.push(mkBlock('http_request', {
        varName:  httpM[1],
        method:   unquote(kw.method  ?? '"GET"'),
        url:      unquote(kw.url     ?? '""'),
        params:   kw.params   ?? '',
        headers:  kw.headers  ?? '',
        json:     kw.json     ?? '',
        data:     kw.data     ?? '',
        files:    kw.files    ?? '',
        cookies:  kw.cookies  ?? '',
        auth:     kw.auth     ?? '',
      }));
      i++; continue;
    }

    // ── For each: for item in iterable:
    const forM = text.match(/^for\s+(\w+)\s+in\s+(.+):$/);
    if (forM) {
      const { blocks: ch, next } = parseGroup(lines, i + 1, baseIndent + 4);
      blocks.push(mkBlock('for_each', { itemVar: forM[1], iterable: forM[2] }, ch));
      i = next; continue;
    }

    // ── If / elif / else
    const ifM = text.match(/^if\s+(.+):$/);
    if (ifM) {
      const { blocks: ch, next: afterIf } = parseGroup(lines, i + 1, baseIndent + 4);
      const elifBranches: ElifBranch[] = [];
      let cur = afterIf;
      while (cur < lines.length && lines[cur].indent === baseIndent) {
        const elifM = lines[cur].text.match(/^elif\s+(.+):$/);
        if (!elifM) break;
        const { blocks: elifCh, next: afterElif } = parseGroup(lines, cur + 1, baseIndent + 4);
        elifBranches.push({ condition: conditionStrToJson(elifM[1]), children: elifCh });
        cur = afterElif;
      }
      let elseBlocks: Block[] = [];
      let fin = cur;
      if (cur < lines.length && lines[cur].indent === baseIndent && lines[cur].text === 'else:') {
        const { blocks: ec, next: afterElse } = parseGroup(lines, cur + 1, baseIndent + 4);
        elseBlocks = ec;
        fin = afterElse;
      }
      blocks.push(mkBlock('if_condition', { conditionExpr: conditionStrToJson(ifM[1]) }, ch, elseBlocks, elifBranches));
      i = fin; continue;
    }

    if (text === 'else:' || /^elif\s/.test(text)) { i++; continue; } // orphan branches

    // ── Print: print(expr)
    if (text.startsWith('print(') && text.endsWith(')')) {
      const inner = text.slice(6, -1).trim();
      blocks.push(mkBlock('print', { expression: unquote(inner) }));
      i++; continue;
    }

    // ── File write: with open(path, 'w') as handle: / handle.write(str(content))
    const fileM = text.match(/^with\s+open\((.+),\s*['"]w['"]\)\s+as\s+(\w+):$/);
    if (fileM) {
      const path = unquote(fileM[1].trim());
      const handle = fileM[2];
      let content = '';
      let next = i + 1;
      if (next < lines.length && lines[next].indent === baseIndent + 4) {
        const wM = lines[next].text.match(new RegExp(`^${handle}\\.write\\(str\\((.+)\\)\\)$`));
        if (wM) { content = unquote(wM[1].trim()); next++; }
      }
      blocks.push(mkBlock('file_write', { path, content }));
      i = next; continue;
    }

    // Skip type-annotated assignments at top level — they were collected as variables in first pass
    if (baseIndent === 0 && /^(\w+)\s*:/.test(text)) { i++; continue; }

    // ── Set variable (catch-all): name = value
    const setM = text.match(/^(\w+)\s*=\s*(.+)$/);
    if (setM) {
      blocks.push(mkBlock('set_variable', { name: setM[1], value: setM[2] }));
      i++; continue;
    }

    i++; // unrecognised line
  }

  return { blocks, next: i };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Parse Scales-generated Python code back into blocks and variables.
 * Recognises the exact patterns emitted by generator.ts; everything else is silently skipped.
 */
export function parsePython(code: string): ParseResult {
  const lines = buildLogicalLines(code);
  const variables: Omit<Variable, 'id'>[] = [];
  const skipped: string[] = [];
  let seenBlock = false;

  // First pass: collect type-annotated top-level assignments as variables (before the first block line)
  for (const { indent, text } of lines) {
    if (!text || indent !== 0) continue;
    if (/^(import |from )/.test(text) || text === 'pass' || text.startsWith('#')) continue;

    // name: [Final[Type] | Final | Type] = value
    const vm = text.match(/^(\w+)\s*:\s*(Final\[(\w+)\]|Final|(\w+))\s*=\s*(.+)$/);
    if (vm && !seenBlock) {
      const isConst = vm[2].startsWith('Final');
      const typeName = vm[3] || vm[4] || 'Any';
      const type = toType(typeName);
      const { value, items, entries } = parseValue(type, vm[5]);
      variables.push({ name: vm[1], type, value, items, entries, locked: false, constant: isConst });
    } else if (!vm) {
      seenBlock = true; // first non-import, non-variable line marks the end of the variable section
    }
  }

  // Second pass: parse blocks from all lines (type-annotated lines at indent 0 are skipped inside parseGroup)
  const { blocks } = parseGroup(lines, 0, 0);

  return { blocks, variables, skipped };
}
