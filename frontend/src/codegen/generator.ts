import { Block, BlockType, Variable, DictEntry, ListItem, PrimitiveType } from '../types';

function collectImports(blocks: Block[]): Set<string> {
  const imports = new Set<string>();
  function scan(block: Block) {
    if (block.type === 'http_request') imports.add('requests');
    block.children.forEach(scan);
    block.elseChildren.forEach(scan);
  }
  blocks.forEach(scan);
  return imports;
}

function escapeStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// If the value exactly matches a named variable, use it as-is (variable reference).
// Otherwise treat as a literal: auto-quote string fields, pass expressions through raw.
function resolveField(
  value: string,
  varNames: Set<string>,
  autoQuote: boolean,
  emptyFallback: string,
): string {
  const v = value.trim();
  if (!v) return autoQuote ? `"${emptyFallback}"` : emptyFallback;
  if (varNames.has(v)) return v;
  if (autoQuote) return `"${escapeStr(v)}"`;
  return v;
}

function generateBlock(block: Block, indent: number, varNames: Set<string>): string {
  const pad  = '    '.repeat(indent);
  const pad1 = '    '.repeat(indent + 1);

  switch (block.type as BlockType) {
    case 'http_request': {
      const {
        method = 'GET', url = '', varName = 'response',
        params = '', headers = '', json = '', data = '', files = '', cookies = '', auth = '',
      } = block.params;
      const urlExpr = resolveField(url, varNames, true, 'https://api.example.com');
      const args: string[] = [`method="${method}"`, `url=${urlExpr}`];
      const expr = (v: string, fb: string) => resolveField(v, varNames, false, fb);
      if (params.trim())  args.push(`params=${expr(params, '{}')}`);
      if (headers.trim()) args.push(`headers=${expr(headers, '{}')}`);
      if (json.trim())    args.push(`json=${expr(json, '{}')}`);
      if (data.trim())    args.push(`data=${expr(data, '""')}`);
      if (files.trim())   args.push(`files=${expr(files, 'None')}`);
      if (cookies.trim()) args.push(`cookies=${expr(cookies, '{}')}`);
      if (auth.trim())    args.push(`auth=${expr(auth, 'None')}`);
      const call = args.length > 2
        ? `requests.request(\n${pad}    ${args.join(`,\n${pad}    `)},\n${pad})`
        : `requests.request(${args.join(', ')})`;
      return `${pad}${varName.trim() || 'response'} = ${call}`;
    }

    case 'set_variable': {
      const { name = 'variable', value = '' } = block.params;
      const valueExpr = resolveField(value, varNames, false, 'None');
      return `${pad}${name.trim() || 'variable'} = ${valueExpr}`;
    }

    case 'for_each': {
      const { itemVar = 'item', iterable = '' } = block.params;
      const iterExpr = resolveField(iterable, varNames, false, '[]');
      const body = block.children.length > 0
        ? block.children.map((c) => generateBlock(c, indent + 1, varNames)).join('\n')
        : `${pad1}pass`;
      return `${pad}for ${itemVar.trim() || 'item'} in ${iterExpr}:\n${body}`;
    }

    case 'if_condition': {
      const { condition = '' } = block.params;
      const condExpr = resolveField(condition, varNames, false, 'True');
      const body = block.children.length > 0
        ? block.children.map((c) => generateBlock(c, indent + 1, varNames)).join('\n')
        : `${pad1}pass`;
      let code = `${pad}if ${condExpr}:\n${body}`;
      if (block.elseChildren.length > 0) {
        const elseBody = block.elseChildren
          .map((c) => generateBlock(c, indent + 1, varNames)).join('\n');
        code += `\n${pad}else:\n${elseBody}`;
      }
      return code;
    }

    case 'print': {
      const { expression = '' } = block.params;
      const exprCode = resolveField(expression, varNames, true, '');
      return `${pad}print(${exprCode || '""'})`;
    }

    case 'file_write': {
      const { path = '', content = '' } = block.params;
      const pathExpr    = resolveField(path,    varNames, true, 'output.txt');
      const contentExpr = resolveField(content, varNames, true, '');
      return `${pad}with open(${pathExpr}, 'w') as f:\n${pad1}f.write(str(${contentExpr || '""'}))`;
    }

    default:
      return `${pad}pass`;
  }
}

function formatPrimitive(type: PrimitiveType, value: string): string {
  switch (type) {
    case 'str':   return `"${escapeStr(value)}"`;
    case 'int':   return value.trim() || '0';
    case 'float': { const f = value.trim() || '0.0'; return f.includes('.') ? f : `${f}.0`; }
    case 'bool':  return value === 'False' ? 'False' : 'True';
  }
}

function formatValue(v: Variable): string {
  switch (v.type) {
    case 'str':   return `"${escapeStr(v.value)}"`;
    case 'int':   return v.value.trim() || '0';
    case 'float': {
      const f = v.value.trim() || '0.0';
      return f.includes('.') ? f : `${f}.0`;
    }
    case 'bool':  return v.value === 'False' ? 'False' : 'True';
    case 'list': {
      if (v.items.length === 0) return '[]';
      return `[${v.items.map((item: ListItem) =>
        formatPrimitive(item.type, item.value)).join(', ')}]`;
    }
    case 'dict': {
      const valid = v.entries.filter((e: DictEntry) => e.key.trim());
      if (valid.length === 0) return '{}';
      const pairs = valid.map((e: DictEntry) =>
        `"${escapeStr(e.key)}": ${formatPrimitive(e.valueType, e.value)}`);
      return `{${pairs.join(', ')}}`;
    }
    case 'None': return 'None';
    case 'Any':  return v.value.trim() || 'None';
  }
}

function generateVariables(variables: Variable[]): string {
  return variables
    .filter((v) => v.name.trim())
    .map((v) => {
      const typed = v.type !== 'None' && v.type !== 'Any';
      const annotation = v.constant
        ? (typed ? `: Final[${v.type}]` : ': Final')
        : (typed ? `: ${v.type}` : '');
      return `${v.name}${annotation} = ${formatValue(v)}`;
    })
    .join('\n');
}

export function generatePython(blocks: Block[], variables: Variable[] = []): string {
  const namedVars = variables.filter((v) => v.name.trim());
  if (blocks.length === 0 && namedVars.length === 0) {
    return '# Add variables or blocks to generate Python code';
  }

  const varNames = new Set(namedVars.map((v) => v.name));

  const imports = collectImports(blocks);
  const stdImports = [...imports].map((m) => `import ${m}`);
  const needsFinal = namedVars.some((v) => v.constant);
  if (needsFinal) stdImports.unshift('from typing import Final');

  const importLines = stdImports.join('\n');
  const varLines    = generateVariables(variables);
  const codeLines   = blocks.map((b) => generateBlock(b, 0, varNames)).join('\n');

  return [importLines || null, varLines || null, codeLines || null]
    .filter(Boolean)
    .join('\n\n');
}
