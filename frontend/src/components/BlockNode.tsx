import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Plus, X } from 'lucide-react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Block, BlockType, BLOCK_META, CompareOp, ConditionClause, ConditionExpr,
  DEFAULT_CONDITION_EXPR, ElifBranch, LogicOp, PythonType, TYPE_LABELS,
} from '../types';
import { useBlockStore } from '../store/blockStore';
import { useLineMap } from '../context/LineMapContext';

const BLOCK_TYPES: BlockType[] = [
  'http_request', 'set_variable', 'for_each', 'if_condition', 'print', 'file_write', 'comment',
];

// Infer a Python type from the literal content of a typed value.
function inferType(value: string): PythonType {
  const v = value.trim();
  if (!v) return 'str';
  if (/^(true|false)$/i.test(v)) return 'bool';
  if (/^-?\d+$/.test(v)) return 'int';
  if (/^-?(\d+\.\d*|\d*\.\d+)([eE][+-]?\d+)?$/.test(v)) return 'float';
  if (v.startsWith('[') && v.endsWith(']')) return 'list';
  if (v.startsWith('{') && v.endsWith('}')) return 'dict';
  return 'str';
}

const TYPE_BADGE: Record<PythonType, string> = {
  str:   'bg-blue-600/80 text-blue-100',
  int:   'bg-emerald-600/80 text-emerald-100',
  float: 'bg-teal-600/80 text-teal-100',
  bool:  'bg-amber-600/80 text-amber-100',
  list:  'bg-violet-600/80 text-violet-100',
  dict:  'bg-rose-600/80 text-rose-100',
  None:  'bg-gray-600/80 text-gray-100',
  Any:   'bg-gray-500/80 text-gray-100',
};

const INPUT_CLS = 'sk-input rounded-lg px-2 py-1 text-xs w-full';
const LABEL_CLS = 'text-xs w-20 flex-shrink-0';
const ROW_CLS   = 'flex items-center gap-2';

const DROPDOWN_STYLE: React.CSSProperties = {
  background: 'var(--popup)',
  border: '1px solid var(--brd-med)',
  boxShadow: 'var(--popup-sh)',
  backdropFilter: 'blur(16px)',
};

// Renders children into document.body at a fixed position — escapes overflow:hidden cards
// and overflow-y:auto scroll containers.
function DropdownPortal({
  anchorRef,
  contentRef,
  open,
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLDivElement>;
  open: boolean;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={contentRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
    >
      {children}
    </div>,
    document.body,
  );
}

// Unified combobox field: focus to see matching variables, type to filter,
// select one to use it as a reference, or keep typing to use as a literal value.
// A "Save as variable" option appears for unmatched typed values.
function SmartField({
  value,
  onChange,
  types,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  types?: PythonType[];
  placeholder?: string;
}) {
  const variables          = useBlockStore((s) => s.variables);
  const addVariableWithName = useBlockStore((s) => s.addVariableWithName);
  const [open, setOpen]       = useState(false);
  const [creating, setCreating] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const anchorRef  = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Variables compatible with this field's type filter
  const compatible = variables.filter(
    (v) => v.name.trim() && (!types || types.includes(v.type)),
  );

  // Filter by what the user has typed (substring match on variable name)
  const filtered = value.trim()
    ? compatible.filter((v) => v.name.toLowerCase().includes(value.toLowerCase()))
    : compatible;

  // If the current value exactly matches a variable name, it's a variable reference
  const matchedVar = compatible.find((v) => v.name === value.trim()) ?? null;
  const isVarRef   = matchedVar !== null;

  const handleSelect = (name: string) => {
    onChange(name);
    setOpen(false);
    setCreating(false);
  };

  const handleCreate = () => {
    if (!newVarName.trim()) return;
    addVariableWithName(newVarName.trim(), inferType(value), value.trim());
    onChange(newVarName.trim());
    setOpen(false);
    setCreating(false);
    setNewVarName('');
  };

  const cancelCreate = () => { setCreating(false); setNewVarName(''); };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!anchorRef.current?.contains(t) && !contentRef.current?.contains(t)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const showCreate = open && value.trim() && !isVarRef;

  return (
    <div ref={anchorRef} className="flex-1 min-w-0">
      {/* Input row */}
      <div
        className={`flex items-center rounded-lg text-xs border transition-all ${
          isVarRef ? 'bg-violet-950/40 border-violet-500/40' : ''
        }`}
        style={!isVarRef ? { background: 'var(--in-bg)', borderColor: 'var(--in-brd)' } : {}}
      >
        <input
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setCreating(false); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setOpen(false); setCreating(false); }
            if (e.key === 'Enter' && filtered.length === 1) handleSelect(filtered[0].name);
          }}
          placeholder={placeholder}
          style={{ color: 'var(--tx)' }}
          className="flex-1 min-w-0 bg-transparent px-2 py-1 placeholder-[var(--tx-4)] focus:outline-none font-mono"
          spellCheck={false}
        />
        {/* Type badge when matched */}
        {isVarRef && matchedVar && (
          <span className={`text-[10px] px-1 py-px rounded-full font-medium flex-shrink-0 mr-1 ${TYPE_BADGE[matchedVar.type]}`}>
            {TYPE_LABELS[matchedVar.type]}
          </span>
        )}
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); setCreating(false); }}
            className={`flex-shrink-0 px-1.5 py-1 transition-colors hover:text-red-400 border-l ${
              isVarRef ? 'text-violet-400/50 border-violet-500/20' : 'border-[var(--brd)]'
            }`}
            style={!isVarRef ? { color: 'var(--tx-4)' } : {}}
          >
            <X size={10} />
          </button>
        )}
        {!value && (
          <ChevronDown size={10} className="flex-shrink-0 mr-2" style={{ color: 'var(--tx-4)' }} />
        )}
      </div>

      {/* Dropdown portal */}
      <DropdownPortal anchorRef={anchorRef} contentRef={contentRef} open={open}>
        <div className="rounded-xl overflow-hidden" style={DROPDOWN_STYLE}>

          {/* Variable list */}
          {filtered.length > 0 && (
            <div className={`py-1 max-h-44 overflow-y-auto ${showCreate ? 'border-b border-[var(--brd)]' : ''}`}>
              {filtered.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleSelect(v.name)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  style={v.name === value ? { background: 'var(--surface2)' } : {}}
                >
                  <span className={`text-[10px] px-1.5 py-px rounded-full font-medium flex-shrink-0 ${TYPE_BADGE[v.type]}`}>
                    {TYPE_LABELS[v.type]}
                  </span>
                  <span className="text-xs font-mono" style={{ color: 'var(--tx)' }}>{v.name}</span>
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 && !value.trim() && (
            <p className="px-3 py-2.5 text-[11px] text-center" style={{ color: 'var(--tx-4)' }}>
              {compatible.length === 0
                ? 'No variables yet — add some in the Variables tab'
                : 'No matching variables'}
            </p>
          )}
          {filtered.length === 0 && value.trim() && !isVarRef && (
            <p className="px-3 py-2 text-[11px]" style={{ color: 'var(--tx-4)' }}>No matching variables</p>
          )}

          {showCreate && (
            creating ? (
              <div className="px-3 py-2 flex items-center gap-1.5">
                <input
                  autoFocus
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') cancelCreate();
                  }}
                  placeholder="variable_name"
                  className="sk-input flex-1 rounded-lg px-2 py-1 text-xs"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!newVarName.trim()}
                  className="text-[11px] px-2 py-1 rounded-lg bg-blue-600/60 hover:bg-blue-500/80 disabled:opacity-40 text-white flex-shrink-0 font-medium border border-blue-500/40 transition-colors"
                >
                  Save
                </button>
                <button type="button" onClick={cancelCreate} className="hover:text-red-400 transition-colors flex-shrink-0" style={{ color: 'var(--tx-3)' }}>
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setCreating(true); setNewVarName(''); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-blue-400/80 hover:text-blue-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors text-[11px]"
              >
                <Plus size={11} className="flex-shrink-0" />
                <span className="flex-1">Save &ldquo;{value}&rdquo; as a variable</span>
                <span className={`text-[10px] px-1.5 py-px rounded-full font-medium flex-shrink-0 ${TYPE_BADGE[inferType(value)]}`}>
                  {TYPE_LABELS[inferType(value)]}
                </span>
              </button>
            )
          )}
        </div>
      </DropdownPortal>
    </div>
  );
}

// For "save as" / output variable name fields — user is naming an output variable,
// not referencing one as a value. Dropdown shows existing vars to reuse + create option.
function OutputVarField({
  value,
  onChange,
  suggestedType = 'Any',
}: {
  value: string;
  onChange: (name: string) => void;
  suggestedType?: PythonType;
}) {
  const variables           = useBlockStore((s) => s.variables);
  const addVariableWithName = useBlockStore((s) => s.addVariableWithName);
  const [open, setOpen] = useState(false);
  const anchorRef  = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const named    = variables.filter((v) => v.name.trim());
  const filtered = value.trim()
    ? named.filter((v) => v.name.toLowerCase().includes(value.toLowerCase()))
    : named;
  const matchedVar = named.find((v) => v.name === value.trim()) ?? null;
  const exists     = matchedVar !== null;
  const showCreate = open && !!value.trim() && !exists;

  const handleSelect = (name: string) => { onChange(name); setOpen(false); };
  const handleCreate = () => {
    addVariableWithName(value.trim(), suggestedType);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!anchorRef.current?.contains(t) && !contentRef.current?.contains(t))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={anchorRef} className="flex-1 min-w-0">
      <div
        className={`flex items-center rounded-lg text-xs border transition-all ${
          exists ? 'bg-violet-950/40 border-violet-500/40' : ''
        }`}
        style={!exists ? { background: 'var(--in-bg)', borderColor: 'var(--in-brd)' } : {}}
      >
        <input
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter' && filtered.length === 1) handleSelect(filtered[0].name);
            if (e.key === 'Enter' && showCreate && filtered.length === 0) handleCreate();
          }}
          placeholder="variable_name"
          style={{ color: 'var(--tx)' }}
          className="flex-1 min-w-0 bg-transparent px-2 py-1 placeholder-[var(--tx-4)] focus:outline-none font-mono"
          spellCheck={false}
        />
        {exists && matchedVar && (
          <span className={`text-[10px] px-1 py-px rounded-full font-medium flex-shrink-0 mr-1 ${TYPE_BADGE[matchedVar.type]}`}>
            {TYPE_LABELS[matchedVar.type]}
          </span>
        )}
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className={`flex-shrink-0 px-1.5 py-1 transition-colors hover:text-red-400 border-l ${
              exists ? 'text-violet-400/50 border-violet-500/20' : 'border-[var(--brd)]'
            }`}
            style={!exists ? { color: 'var(--tx-4)' } : {}}
          >
            <X size={10} />
          </button>
        )}
        {!value && <ChevronDown size={10} className="flex-shrink-0 mr-2" style={{ color: 'var(--tx-4)' }} />}
      </div>

      <DropdownPortal anchorRef={anchorRef} contentRef={contentRef} open={open}>
        <div className="rounded-xl overflow-hidden" style={DROPDOWN_STYLE}>
          {filtered.length > 0 && (
            <div className={`py-1 max-h-44 overflow-y-auto ${showCreate ? 'border-b border-[var(--brd)]' : ''}`}>
              {filtered.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleSelect(v.name)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  style={v.name === value ? { background: 'var(--surface2)' } : {}}
                >
                  <span className={`text-[10px] px-1.5 py-px rounded-full font-medium flex-shrink-0 ${TYPE_BADGE[v.type]}`}>
                    {TYPE_LABELS[v.type]}
                  </span>
                  <span className="text-xs font-mono" style={{ color: 'var(--tx)' }}>{v.name}</span>
                </button>
              ))}
            </div>
          )}
          {filtered.length === 0 && !value.trim() && (
            <p className="px-3 py-2.5 text-[11px] text-center" style={{ color: 'var(--tx-4)' }}>
              {named.length === 0 ? 'No variables yet' : 'No matching variables'}
            </p>
          )}
          {showCreate && (
            <button
              type="button"
              onClick={handleCreate}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-blue-400/80 hover:text-blue-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors text-[11px]"
            >
              <Plus size={11} className="flex-shrink-0" />
              Create variable &ldquo;{value}&rdquo;
            </button>
          )}
        </div>
      </DropdownPortal>
    </div>
  );
}

// ── Condition builder ─────────────────────────────────────────────────────────

const OP_OPTIONS: { value: CompareOp; label: string; short: string }[] = [
  { value: 'is',     label: 'is (truthy/exists)',    short: 'is'     },
  { value: '==',     label: '== equals',             short: '=='     },
  { value: '!=',     label: '!= not equals',         short: '!='     },
  { value: '>',      label: '> greater than',        short: '>'      },
  { value: '<',      label: '< less than',           short: '<'      },
  { value: '>=',     label: '>= greater or equal',   short: '>='     },
  { value: '<=',     label: '<= less or equal',      short: '<='     },
  { value: 'in',     label: 'in (contains)',         short: 'in'     },
  { value: 'not in', label: 'not in (excludes)',     short: 'not in' },
];

function parseCondExpr(json: string): ConditionExpr {
  try {
    const v = JSON.parse(json) as ConditionExpr;
    if (v?.clauses?.length) return v;
  } catch { /* fall through */ }
  return { ...DEFAULT_CONDITION_EXPR, clauses: [{ ...DEFAULT_CONDITION_EXPR.clauses[0] }] };
}

function ConditionBuilder({
  value,
  onChange,
}: {
  value: string;         // JSON-serialised ConditionExpr
  onChange: (v: string) => void;
}) {
  const expr = useMemo(() => parseCondExpr(value), [value]);
  const save = (next: ConditionExpr) => onChange(JSON.stringify(next));

  const updateClause = (i: number, patch: Partial<ConditionClause>) => {
    const clauses = expr.clauses.map((c, j) => j === i ? { ...c, ...patch } : c);
    // If op changed to 'is', clear right
    if (patch.op === 'is') clauses[i].right = '';
    save({ ...expr, clauses });
  };

  const addClause = (joiner: LogicOp) => {
    save({
      clauses: [...expr.clauses, { not: false, left: '', op: 'is', right: '' }],
      joiners: [...expr.joiners, joiner],
    });
  };

  const removeClause = (i: number) => {
    const clauses = expr.clauses.filter((_, j) => j !== i);
    const joiners = expr.joiners.filter((_, j) => j !== i && j !== i - 1).slice(0, clauses.length - 1);
    save({ clauses, joiners });
  };

  const toggleJoiner = (i: number) => {
    const joiners = expr.joiners.map((j, k) => k === i ? (j === 'and' ? 'or' : 'and') : j);
    save({ ...expr, joiners });
  };

  return (
    <div className="space-y-2 mt-2">
      {expr.clauses.map((clause, i) => {
        const showRight = clause.op !== 'is';
        return (
          <div key={i}>
            {/* Joiner between clauses */}
            {i > 0 && (
              <div className="flex items-center gap-2 py-1">
                <div className="flex-1 h-px" style={{ background: 'var(--brd)' }} />
                <button
                  type="button"
                  onClick={() => toggleJoiner(i - 1)}
                  className="px-3 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest border transition-all"
                  style={{ background: 'var(--surface)', borderColor: 'var(--brd-med)', color: 'var(--tx-3)' }}
                >
                  {expr.joiners[i - 1] ?? 'and'}
                </button>
                <div className="flex-1 h-px" style={{ background: 'var(--brd)' }} />
              </div>
            )}

            {/* Clause row */}
            <div className="flex items-center gap-1.5">
              {/* NOT toggle */}
              <button
                type="button"
                onClick={() => updateClause(i, { not: !clause.not })}
                title="Wrap with not(...)"
                className="flex-shrink-0 text-[9px] font-mono font-bold px-1.5 py-[5px] rounded-md border transition-all leading-none"
                style={clause.not
                  ? { background: 'rgba(245,158,11,0.2)', borderColor: 'rgba(251,191,36,0.5)', color: 'rgb(252,211,77)' }
                  : { background: 'var(--surface)', borderColor: 'var(--brd)', color: 'var(--tx-4)' }
                }
              >
                NOT
              </button>

              {/* Left operand */}
              <SmartField
                value={clause.left}
                onChange={(v) => updateClause(i, { left: v })}
                placeholder={clause.op === 'in' || clause.op === 'not in' ? 'item' : 'value or variable'}
              />

              {/* Operator */}
              <select
                value={clause.op}
                onChange={(e) => updateClause(i, { op: e.target.value as CompareOp })}
                className="sk-select flex-shrink-0 rounded-lg px-1.5 py-[5px] text-[11px] font-mono"
                style={{ minWidth: 72 }}
              >
                {OP_OPTIONS.map(({ value: v, label }) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>

              {/* Right operand — hidden for 'is' */}
              {showRight ? (
                <SmartField
                  value={clause.right}
                  onChange={(v) => updateClause(i, { right: v })}
                  placeholder={
                    clause.op === 'in' || clause.op === 'not in'
                      ? 'list or variable'
                      : clause.op === '>' || clause.op === '<' || clause.op === '>=' || clause.op === '<='
                        ? 'number or variable'
                        : 'value or variable'
                  }
                />
              ) : (
                <div className="flex-1" />
              )}

              {/* Remove clause */}
              {expr.clauses.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeClause(i)}
                  className="flex-shrink-0 hover:text-red-400 transition-colors"
                  style={{ color: 'var(--tx-4)' }}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Add clause */}
      <div className="flex items-center gap-1.5 pt-0.5">
        <span className="text-[10px] font-mono" style={{ color: 'var(--tx-4)' }}>+</span>
        {(['and', 'or'] as LogicOp[]).map((j) => (
          <button
            key={j}
            type="button"
            onClick={() => addClause(j)}
            className="text-[10px] font-mono transition-colors px-2 py-0.5 rounded border border-dashed hover:text-blue-400"
            style={{ color: 'var(--tx-3)', borderColor: 'var(--brd-med)' }}
          >
            {j}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

// Compact "+" circle between/after blocks. Clicking expands to a full-width search input.
export function InsertBlockMenu({ index, parentId, inElse, elifIdx }: { index: number; parentId?: string; inElse?: boolean; elifIdx?: number }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const insertBlock = useBlockStore((s) => s.insertBlock);
  const anchorRef   = useRef<HTMLDivElement>(null);
  const contentRef  = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  const filtered = BLOCK_TYPES.filter((type) =>
    BLOCK_META[type].label.toLowerCase().includes(query.toLowerCase()),
  );

  const close = () => { setOpen(false); setQuery(''); };

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!anchorRef.current?.contains(t) && !contentRef.current?.contains(t)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={anchorRef} className="my-2 group">
      {open ? (
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close();
            if (e.key === 'Enter' && filtered.length === 1) {
              insertBlock(filtered[0], index, parentId, inElse, elifIdx);
              close();
            }
          }}
          placeholder="+ Add action"
          className="sk-input w-full rounded-xl px-2 py-1 text-xs"
          spellCheck={false}
        />
      ) : (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-5 h-5 rounded-full border border-dashed flex items-center justify-center transition-all"
            style={{ borderColor: 'var(--brd-med)', color: 'var(--tx-4)' }}
          >
            <Plus size={9} />
          </button>
        </div>
      )}

      <DropdownPortal anchorRef={anchorRef} contentRef={contentRef} open={open}>
        <div className="rounded-xl overflow-hidden" style={DROPDOWN_STYLE}>
          <div className="py-1">
            {filtered.length > 0 ? filtered.map((type) => {
              const meta = BLOCK_META[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => { insertBlock(type, index, parentId, inElse, elifIdx); close(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.color}`} />
                  <span className="text-xs" style={{ color: 'var(--tx)' }}>{meta.label}</span>
                </button>
              );
            }) : (
              <p className="px-3 py-2 text-[11px]" style={{ color: 'var(--tx-4)' }}>No matching actions</p>
            )}
          </div>
        </div>
      </DropdownPortal>
    </div>
  );
}

export function AddBlockMenu({ parentId, inElse, elifIdx }: { parentId?: string; inElse?: boolean; elifIdx?: number }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const addBlock   = useBlockStore((s) => s.addBlock);
  const anchorRef  = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const filtered = BLOCK_TYPES.filter((type) =>
    BLOCK_META[type].label.toLowerCase().includes(query.toLowerCase()),
  );

  const close = () => { setOpen(false); setQuery(''); };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!anchorRef.current?.contains(t) && !contentRef.current?.contains(t)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={anchorRef} className="mt-1.5">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
          if (e.key === 'Enter' && filtered.length === 1) {
            addBlock(filtered[0], parentId, inElse, elifIdx);
            close();
          }
        }}
        placeholder={`+ Add action${inElse ? ' (else)' : ''}`}
        className="sk-input w-full text-xs px-2 py-1 rounded-xl"
        style={open ? {} : { background: 'transparent', borderStyle: 'dashed', color: 'var(--tx-3)', cursor: 'pointer' }}
        spellCheck={false}
      />

      <DropdownPortal anchorRef={anchorRef} contentRef={contentRef} open={open}>
        <div className="rounded-xl overflow-hidden" style={DROPDOWN_STYLE}>
          <div className="py-1">
            {filtered.length > 0 ? filtered.map((type) => {
              const meta = BLOCK_META[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => { addBlock(type, parentId, inElse, elifIdx); close(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.color}`} />
                  <span className="text-xs" style={{ color: 'var(--tx)' }}>{meta.label}</span>
                </button>
              );
            }) : (
              <p className="px-3 py-2 text-[11px]" style={{ color: 'var(--tx-4)' }}>No matching actions</p>
            )}
          </div>
        </div>
      </DropdownPortal>
    </div>
  );
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function HttpRequestParams({ block }: { block: Block }) {
  const updateBlock = useBlockStore((s) => s.updateBlock);
  const set = (key: string, val: string) => updateBlock(block.id, { [key]: val });
  const up  = (key: string) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    updateBlock(block.id, { [key]: e.target.value });

  const p = block.params;
  const advancedKeys = ['data', 'files', 'cookies', 'auth'] as const;
  const hasAdvancedValue = advancedKeys.some((k) => p[k]?.trim());
  const [showAdvanced, setShowAdvanced] = useState(hasAdvancedValue);

  return (
    <div className="space-y-1.5 mt-2">
      <div className={ROW_CLS}>
        <span className={LABEL_CLS}>Method</span>
        <select value={p.method || 'GET'} onChange={up('method')} className={INPUT_CLS}>
          {HTTP_METHODS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>
      <div className={ROW_CLS}>
        <span className={LABEL_CLS}>URL</span>
        <SmartField value={p.url || ''} onChange={(v) => set('url', v)}
          types={['str', 'Any']} placeholder="api.example.com/v1/endpoint" />
      </div>
      <div className={ROW_CLS}>
        <span className={LABEL_CLS}>Save as</span>
        <OutputVarField value={p.varName || ''} onChange={(v) => set('varName', v)} suggestedType="Any" />
      </div>
      <div className={ROW_CLS}>
        <span className={LABEL_CLS}>Params</span>
        <SmartField value={p.params || ''} onChange={(v) => set('params', v)}
          types={['dict', 'Any']} placeholder='{"page": 1}' />
      </div>
      <div className={ROW_CLS}>
        <span className={LABEL_CLS}>Headers</span>
        <SmartField value={p.headers || ''} onChange={(v) => set('headers', v)}
          types={['dict', 'Any']} placeholder='{"Authorization": "Bearer ..."}' />
      </div>
      <div className={ROW_CLS}>
        <span className={LABEL_CLS}>JSON body</span>
        <SmartField value={p.json || ''} onChange={(v) => set('json', v)}
          types={['dict', 'list', 'Any']} placeholder='{"key": "value"}' />
      </div>

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-[11px] transition-colors pt-0.5 hover:text-blue-400"
      style={{ color: 'var(--tx-3)' }}
      >
        {showAdvanced ? '− Hide advanced' : '+ Advanced (data, files, cookies, auth)'}
      </button>

      {showAdvanced && (
        <>
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Raw data</span>
            <SmartField value={p.data || ''} onChange={(v) => set('data', v)}
              types={['str', 'Any']} placeholder="raw body string" />
          </div>
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Files</span>
            <SmartField value={p.files || ''} onChange={(v) => set('files', v)}
              types={['dict', 'Any']} placeholder='{"file": open("f.txt", "rb")}' />
          </div>
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Cookies</span>
            <SmartField value={p.cookies || ''} onChange={(v) => set('cookies', v)}
              types={['dict', 'Any']} placeholder='{"session": "abc123"}' />
          </div>
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Auth</span>
            <SmartField value={p.auth || ''} onChange={(v) => set('auth', v)}
              types={['Any']} placeholder='("username", "password")' />
          </div>
        </>
      )}
    </div>
  );
}

function BlockParams({ block }: { block: Block }) {
  const updateBlock = useBlockStore((s) => s.updateBlock);

  const up  = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    updateBlock(block.id, { [key]: e.target.value });
  const set = (key: string, val: string) => updateBlock(block.id, { [key]: val });

  switch (block.type) {
    case 'http_request':
      return <HttpRequestParams block={block} />;

    case 'set_variable':
      return (
        <div className="space-y-1.5 mt-2">
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Variable</span>
            <OutputVarField
              value={block.params.name || ''}
              onChange={(v) => set('name', v)}
              suggestedType="Any"
            />
          </div>
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Value</span>
            <SmartField
              value={block.params.value || ''}
              onChange={(v) => set('value', v)}
              placeholder="value or expression"
            />
          </div>
        </div>
      );

    case 'for_each':
      return (
        <div className="space-y-1.5 mt-2">
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Each item</span>
            <input
              value={block.params.itemVar || ''}
              onChange={up('itemVar')}
              className={`${INPUT_CLS} font-mono flex-1`}
              placeholder="item"
            />
          </div>
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>in</span>
            <SmartField
              value={block.params.iterable || ''}
              onChange={(v) => set('iterable', v)}
              types={['list', 'dict', 'Any']}
              placeholder="my_list"
            />
          </div>
        </div>
      );

    case 'if_condition':
      return (
        <ConditionBuilder
          value={block.params.conditionExpr || ''}
          onChange={(v) => set('conditionExpr', v)}
        />
      );

    case 'print':
      return (
        <div className={`${ROW_CLS} mt-2`}>
          <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--tx-3)' }}>print(</span>
          <SmartField
            value={block.params.expression || ''}
            onChange={(v) => set('expression', v)}
            placeholder="Hello, world!"
          />
          <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--tx-3)' }}>)</span>
        </div>
      );

    case 'file_write':
      return (
        <div className="space-y-1.5 mt-2">
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Path</span>
            <SmartField
              value={block.params.path || ''}
              onChange={(v) => set('path', v)}
              types={['str', 'Any']}
              placeholder="output.txt"
            />
          </div>
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Content</span>
            <SmartField
              value={block.params.content || ''}
              onChange={(v) => set('content', v)}
              placeholder="data to write"
            />
          </div>
        </div>
      );

    case 'comment':
      return (
        <div className={`${ROW_CLS} mt-2`}>
          <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--tx-3)' }}>#</span>
          <input
            value={block.params.text || ''}
            onChange={up('text')}
            className={`${INPUT_CLS} flex-1`}
            placeholder="your comment here"
          />
        </div>
      );

    default:
      return null;
  }
}

function ElifSection({
  branch,
  branchIdx,
  blockId,
  depth,
}: {
  branch: ElifBranch;
  branchIdx: number;
  blockId: string;
  depth: number;
}) {
  const removeElifBranch   = useBlockStore((s) => s.removeElifBranch);
  const updateElifCondition = useBlockStore((s) => s.updateElifCondition);

  return (
    <div className="mt-3 pl-3 border-l" style={{ borderColor: 'var(--brd-med)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono" style={{ color: 'var(--tx-3)' }}>elif</span>
        <button
          type="button"
          onClick={() => removeElifBranch(blockId, branchIdx)}
          title="Remove elif"
          className="hover:text-red-400 transition-colors"
          style={{ color: 'var(--tx-4)' }}
        >
          <X size={11} />
        </button>
      </div>
      <ConditionBuilder
        value={branch.condition}
        onChange={(v) => updateElifCondition(blockId, branchIdx, v)}
      />
      {branch.children.length === 0 ? (
        <AddBlockMenu parentId={blockId} elifIdx={branchIdx} />
      ) : (
        <SortableContext items={branch.children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {branch.children.map((child, i) => (
            <div key={child.id}>
              <BlockNode block={child} depth={depth + 1} />
              <InsertBlockMenu index={i + 1} parentId={blockId} elifIdx={branchIdx} />
            </div>
          ))}
        </SortableContext>
      )}
    </div>
  );
}

export default function BlockNode({ block, depth = 0 }: { block: Block; depth?: number }) {
  const removeBlock     = useBlockStore((s) => s.removeBlock);
  const addElifBranch   = useBlockStore((s) => s.addElifBranch);
  const selectBlock     = useBlockStore((s) => s.selectBlock);
  const setCollapsed    = useBlockStore((s) => s.setCollapsed);
  const selectedBlockId = useBlockStore((s) => s.selectedBlockId);
  const isCollapsed     = useBlockStore((s) => !!s.collapsedBlocks[block.id]);
  const isSelected      = selectedBlockId === block.id;
  const meta            = BLOCK_META[block.type];
  const lineMap         = useLineMap();
  const lineNum         = lineMap[block.id];

  const childCount = block.children.length
    + block.elseChildren.length
    + block.elifBranches.reduce((n, br) => n + br.children.length, 0);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    data: { type: 'block' },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="my-1"
      onClick={(e) => { e.stopPropagation(); selectBlock(block.id); }}
    >
      <div
        className={`rounded-2xl border overflow-hidden transition-all duration-100 ${isSelected ? 'border-black/25 dark:border-white/45' : meta.borderColor}`}
        style={{
          background: 'var(--surface)',
          boxShadow: isSelected ? `0 0 0 2px var(--sel-ring)` : undefined,
        }}
      >
        <div className={`${meta.color} px-3 py-1.5 flex items-center gap-1.5`}>
          {/* Drag handle — only this triggers drag, leaving inputs/buttons unaffected */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="flex-shrink-0 text-white/30 hover:text-white/70 cursor-grab active:cursor-grabbing touch-none transition-colors"
            title="Drag to reorder"
          >
            <GripVertical size={13} />
          </button>
          <span className="text-white font-semibold text-xs uppercase tracking-wider flex-1">
            {meta.label}
          </span>
          {lineNum && (
            <span className="text-[10px] font-mono text-white/30 mr-0.5">L{lineNum}</span>
          )}
          {isCollapsed && childCount > 0 && (
            <span className="text-white/30 text-[10px] font-mono mr-1">{childCount}</span>
          )}
          <button
            onClick={() => setCollapsed(block.id, !isCollapsed)}
            title={isCollapsed ? 'Expand' : 'Collapse'}
            className="text-white/40 hover:text-white/80 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition-colors"
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
          <button onClick={() => removeBlock(block.id)} title="Remove"
            className="text-white/50 hover:text-red-300 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition-colors">
            <X size={12} />
          </button>
        </div>

        {!isCollapsed && <div className="px-3 pb-3">
          <BlockParams block={block} />

          {meta.isContainer && (
            <div className="mt-3 pl-3 border-l" style={{ borderColor: 'var(--brd-med)' }}>
              <p className="text-xs mb-1 font-mono" style={{ color: 'var(--tx-3)' }}>do:</p>
              {block.children.length === 0 ? (
                <AddBlockMenu parentId={block.id} />
              ) : (
                <SortableContext items={block.children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  {block.children.map((child, i) => (
                    <div key={child.id}>
                      <BlockNode block={child} depth={depth + 1} />
                      <InsertBlockMenu index={i + 1} parentId={block.id} />
                    </div>
                  ))}
                </SortableContext>
              )}
            </div>
          )}

          {block.type === 'if_condition' && (block.elifBranches ?? []).map((branch, idx) => (
            <ElifSection key={idx} branch={branch} branchIdx={idx} blockId={block.id} depth={depth} />
          ))}

          {block.type === 'if_condition' && (
            <button
              type="button"
              onClick={() => addElifBranch(block.id)}
              className="mt-2 ml-3 text-[11px] transition-colors font-mono hover:text-blue-400"
              style={{ color: 'var(--tx-3)' }}
            >
              + elif
            </button>
          )}

          {block.type === 'if_condition' && (
            <div className="mt-3 pl-3 border-l" style={{ borderColor: 'var(--brd-med)' }}>
              <p className="text-xs mb-1 font-mono" style={{ color: 'var(--tx-3)' }}>else: (optional)</p>
              {block.elseChildren.length === 0 ? (
                <AddBlockMenu parentId={block.id} inElse={true} />
              ) : (
                <SortableContext items={block.elseChildren.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  {block.elseChildren.map((child, i) => (
                    <div key={child.id}>
                      <BlockNode block={child} depth={depth + 1} />
                      <InsertBlockMenu index={i + 1} parentId={block.id} inElse={true} />
                    </div>
                  ))}
                </SortableContext>
              )}
            </div>
          )}
        </div>}

        {isSelected && (
          <div className="px-3 pb-2">
            <div className="pt-2 border-t flex items-center gap-3 flex-wrap" style={{ borderColor: 'var(--brd)' }}>
              {[
                ['↑↓', 'select'],
                ['⌘↑↓', 'move'],
                ['←→', 'collapse'],
                ['⌘C', 'copy'],
                ['⌘X', 'cut'],
                ['⌘V', 'paste'],
                ['⌫', 'delete'],
                ['Esc', 'deselect'],
              ].map(([key, label]) => (
                <span key={key} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--tx-3)' }}>
                  <kbd className="font-mono" style={{ color: 'var(--tx-2)' }}>{key}</kbd>
                  <span>{label}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
