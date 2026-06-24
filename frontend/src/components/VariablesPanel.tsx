import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, ChevronUp, ChevronDown, X, Lock, Package } from 'lucide-react';
import { Variable, PythonType, PYTHON_TYPES, TYPE_LABELS, SortMode, ListItem, DictEntry, PRIMITIVE_TYPES, PRIMITIVE_SHORT, PRIMITIVE_DEFAULTS } from '../types';
import { useBlockStore } from '../store/blockStore';

function formatPreview(v: Variable): string {
  switch (v.type) {
    case 'str':
      if (!v.value) return '""';
      return v.value.length > 40 ? `"${v.value.slice(0, 40)}…"` : `"${v.value}"`;
    case 'int':
      return v.value || '0';
    case 'float': {
      const f = v.value || '0.0';
      return f.includes('.') ? f : `${f}.0`;
    }
    case 'bool':
      return v.value || 'True';
    case 'list': {
      if (v.items.length === 0) return '[]';
      const fmt = (item: ListItem) =>
        item.type === 'str' ? `"${item.value || ''}"` : item.value || PRIMITIVE_DEFAULTS[item.type];
      const shown = v.items.slice(0, 3).map(fmt).join(', ');
      return v.items.length > 3 ? `[${shown}, +${v.items.length - 3} more]` : `[${shown}]`;
    }
    case 'dict': {
      const valid = v.entries.filter((e: DictEntry) => e.key.trim());
      if (valid.length === 0) return '{}';
      const fmtVal = (e: DictEntry) =>
        e.valueType === 'str' ? `"${e.value}"` : e.value || PRIMITIVE_DEFAULTS[e.valueType];
      const first = `"${valid[0].key}": ${fmtVal(valid[0])}`;
      return valid.length > 1 ? `{${first}, +${valid.length - 1} more}` : `{${first}}`;
    }
    case 'None':
      return 'None';
    case 'Any':
      return v.value || '…';
  }
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

const INPUT_CLS =
  'w-full bg-white/[0.08] border border-white/10 rounded-xl px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-400/70 disabled:opacity-30 disabled:cursor-not-allowed';

const SELECT_CLS =
  'w-full bg-white/[0.08] border border-white/10 rounded-xl px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400/70 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed';

const ADD_ITEM_CLS =
  'w-full text-xs text-white/30 hover:text-white/70 border border-dashed border-white/15 hover:border-white/30 rounded-xl py-1.5 transition-colors mt-1 disabled:opacity-30 disabled:cursor-not-allowed';

function ValueEditor({ variable: v, locked }: { variable: Variable; locked: boolean }) {
  const updateVariable  = useBlockStore((s) => s.updateVariable);
  const addListItem     = useBlockStore((s) => s.addListItem);
  const updateListItem  = useBlockStore((s) => s.updateListItem);
  const removeListItem  = useBlockStore((s) => s.removeListItem);
  const moveListItem    = useBlockStore((s) => s.moveListItem);
  const addDictEntry    = useBlockStore((s) => s.addDictEntry);
  const updateDictEntry = useBlockStore((s) => s.updateDictEntry);
  const removeDictEntry = useBlockStore((s) => s.removeDictEntry);
  const moveDictEntry   = useBlockStore((s) => s.moveDictEntry);

  const upVal = (value: string) => updateVariable(v.id, { value });

  switch (v.type) {
    case 'str':
      return <input disabled={locked} value={v.value} onChange={(e) => upVal(e.target.value)} placeholder="Enter text..." className={INPUT_CLS} />;

    case 'int':
      return <input disabled={locked} type="number" step="1" value={v.value} onChange={(e) => upVal(e.target.value)} placeholder="0" className={INPUT_CLS} />;

    case 'float':
      return <input disabled={locked} type="number" step="any" value={v.value} onChange={(e) => upVal(e.target.value)} placeholder="0.0" className={INPUT_CLS} />;

    case 'bool':
      return (
        <select disabled={locked} value={v.value} onChange={(e) => upVal(e.target.value)} className={SELECT_CLS}>
          <option value="True">True</option>
          <option value="False">False</option>
        </select>
      );

    case 'list':
      return (
        <div className="space-y-1.5">
          {v.items.length === 0 && <p className="text-xs text-white/25 italic">No items yet</p>}
          {v.items.map((item: ListItem, idx: number) => (
            <div key={idx} className="group/row flex items-center gap-1.5">
              {!locked && (
                <div className="flex flex-col gap-px flex-shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
                  <button onClick={() => moveListItem(v.id, idx, 'up')} disabled={idx === 0}
                    className="text-white/25 hover:text-white/70 disabled:opacity-20 w-4 h-4 flex items-center justify-center rounded"><ArrowUp size={10} /></button>
                  <button onClick={() => moveListItem(v.id, idx, 'down')} disabled={idx === v.items.length - 1}
                    className="text-white/25 hover:text-white/70 disabled:opacity-20 w-4 h-4 flex items-center justify-center rounded"><ArrowDown size={10} /></button>
                </div>
              )}
              <select
                disabled={locked}
                value={item.type}
                onChange={(e) => updateListItem(v.id, idx, { type: e.target.value as ListItem['type'] })}
                className="bg-white/10 border border-white/15 rounded-lg text-xs text-white px-1 py-1.5 focus:outline-none focus:border-blue-400/70 flex-shrink-0 w-14 disabled:opacity-40"
              >
                {PRIMITIVE_TYPES.map((t) => (
                  <option key={t} value={t}>{PRIMITIVE_SHORT[t]}</option>
                ))}
              </select>
              {item.type === 'bool' ? (
                <select disabled={locked} value={item.value}
                  onChange={(e) => updateListItem(v.id, idx, { value: e.target.value })}
                  className={`${INPUT_CLS} flex-1`}>
                  <option value="True">True</option>
                  <option value="False">False</option>
                </select>
              ) : (
                <input
                  disabled={locked}
                  type={item.type === 'int' || item.type === 'float' ? 'number' : 'text'}
                  step={item.type === 'float' ? 'any' : undefined}
                  value={item.value}
                  onChange={(e) => updateListItem(v.id, idx, { value: e.target.value })}
                  placeholder={PRIMITIVE_DEFAULTS[item.type] || `Item ${idx + 1}`}
                  className={`${INPUT_CLS} flex-1`}
                />
              )}
              {!locked && (
                <button onClick={() => removeListItem(v.id, idx)}
                  className="text-white/25 hover:text-red-400 w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 flex-shrink-0 transition-colors opacity-0 group-hover/row:opacity-100"
                ><X size={12} /></button>
              )}
            </div>
          ))}
          {!locked && <button onClick={() => addListItem(v.id)} className={ADD_ITEM_CLS}>+ Add item</button>}
        </div>
      );

    case 'dict':
      return (
        <div className="space-y-2">
          {v.entries.length === 0 && <p className="text-xs text-white/25 italic">No entries yet</p>}
          {v.entries.map((entry: DictEntry, idx: number) => (
            <div key={idx} className="group/row bg-white/[0.04] border border-white/[0.08] rounded-xl p-2 space-y-1.5">
              {/* Key row + controls */}
              <div className="flex items-center gap-1.5">
                <input
                  disabled={locked}
                  value={entry.key}
                  onChange={(e) => updateDictEntry(v.id, idx, { key: e.target.value })}
                  placeholder="key"
                  className={`${INPUT_CLS} flex-1`}
                />
                {!locked && (
                  <div className="flex gap-px opacity-0 group-hover/row:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => moveDictEntry(v.id, idx, 'up')} disabled={idx === 0}
                      className="text-white/25 hover:text-white/70 disabled:opacity-20 w-5 h-5 flex items-center justify-center rounded"><ArrowUp size={12} /></button>
                    <button onClick={() => moveDictEntry(v.id, idx, 'down')} disabled={idx === v.entries.length - 1}
                      className="text-white/25 hover:text-white/70 disabled:opacity-20 w-5 h-5 flex items-center justify-center rounded"><ArrowDown size={12} /></button>
                    <button onClick={() => removeDictEntry(v.id, idx)}
                      className="text-white/25 hover:text-red-400 w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 transition-colors"><X size={12} /></button>
                  </div>
                )}
              </div>
              {/* Value type + value row */}
              <div className="flex items-center gap-1.5">
                <select
                  disabled={locked}
                  value={entry.valueType}
                  onChange={(e) => updateDictEntry(v.id, idx, { valueType: e.target.value as DictEntry['valueType'] })}
                  className="bg-white/10 border border-white/15 rounded-lg text-xs text-white px-1 py-1.5 focus:outline-none focus:border-blue-400/70 flex-shrink-0 w-14 disabled:opacity-40"
                >
                  {PRIMITIVE_TYPES.map((t) => (
                    <option key={t} value={t}>{PRIMITIVE_SHORT[t]}</option>
                  ))}
                </select>
                {entry.valueType === 'bool' ? (
                  <select disabled={locked} value={entry.value}
                    onChange={(e) => updateDictEntry(v.id, idx, { value: e.target.value })}
                    className={`${INPUT_CLS} flex-1`}>
                    <option value="True">True</option>
                    <option value="False">False</option>
                  </select>
                ) : (
                  <input
                    disabled={locked}
                    type={entry.valueType === 'int' || entry.valueType === 'float' ? 'number' : 'text'}
                    step={entry.valueType === 'float' ? 'any' : undefined}
                    value={entry.value}
                    onChange={(e) => updateDictEntry(v.id, idx, { value: e.target.value })}
                    placeholder="value"
                    className={`${INPUT_CLS} flex-1`}
                  />
                )}
              </div>
            </div>
          ))}
          {!locked && <button onClick={() => addDictEntry(v.id)} className={ADD_ITEM_CLS}>+ Add entry</button>}
        </div>
      );

    case 'None':
      return <div className="px-2.5 py-1.5 text-sm text-white/30 bg-white/[0.04] border border-white/[0.08] rounded-xl select-none">None</div>;

    case 'Any':
      return (
        <div>
          <input disabled={locked} value={v.value} onChange={(e) => upVal(e.target.value)} placeholder="e.g. os.environ.get('KEY')" className={`${INPUT_CLS} font-mono`} spellCheck={false} />
          {!locked && <p className="text-xs text-white/25 mt-1">Enter a Python expression directly</p>}
        </div>
      );

    default:
      return null;
  }
}

export default function VariablesPanel() {
  const variables           = useBlockStore((s) => s.variables);
  const addVariable         = useBlockStore((s) => s.addVariable);
  const removeVariable      = useBlockStore((s) => s.removeVariable);
  const updateVariable      = useBlockStore((s) => s.updateVariable);
  const moveVariable        = useBlockStore((s) => s.moveVariable);
  const toggleLock          = useBlockStore((s) => s.toggleLock);
  const sortBy              = useBlockStore((s) => s.variableSortMode);
  const setSortBy           = useBlockStore((s) => s.setVariableSortMode);
  const [expandedIds, setExpandedIds]     = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const prevCountRef = useRef(variables.length);

  // Cancel pending delete when anything outside the button is clicked
  useEffect(() => {
    if (!pendingDeleteId) return;
    const cancel = () => setPendingDeleteId(null);
    document.addEventListener('mousedown', cancel);
    return () => document.removeEventListener('mousedown', cancel);
  }, [pendingDeleteId]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (pendingDeleteId === id) {
      removeVariable(id);
      setPendingDeleteId(null);
    } else {
      setPendingDeleteId(id);
    }
  };

  // Auto-expand newly added variables
  useEffect(() => {
    if (variables.length > prevCountRef.current) {
      const newest = variables[variables.length - 1];
      setExpandedIds((prev) => new Set([...prev, newest.id]));
    }
    prevCountRef.current = variables.length;
  }, [variables]);

  const toggle = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleToggleLock = (id: string, currentlyLocked: boolean) => {
    toggleLock(id);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (!currentlyLocked) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const sortedVariables = useMemo(() => {
    if (sortBy === 'custom') return variables;
    const copy = [...variables];
    if (sortBy === 'name-asc')  copy.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'name-desc') copy.sort((a, b) => b.name.localeCompare(a.name));
    if (sortBy === 'type')      copy.sort((a, b) => TYPE_LABELS[a.type].localeCompare(TYPE_LABELS[b.type]));
    return copy;
  }, [variables, sortBy]);

  const isCustom = sortBy === 'custom';

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Sort control */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
        <span className="text-xs text-white/30 flex-shrink-0">Sort</span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortMode)}
          className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-lg text-xs text-white/60 px-2 py-1 focus:outline-none focus:border-blue-400/70 cursor-pointer"
        >
          <option value="custom">Custom order</option>
          <option value="name-asc">Name A → Z</option>
          <option value="name-desc">Name Z → A</option>
          <option value="type">Type</option>
        </select>
      </div>

      {/* Variable list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {variables.length === 0 && (
          <div className="text-center py-12 px-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/[0.08]"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <Package size={22} className="text-white/25" />
            </div>
            <p className="text-white/50 text-sm font-semibold mb-1">No variables yet</p>
            <p className="text-white/25 text-xs leading-relaxed">Set your values here — they appear at the top of your generated script</p>
          </div>
        )}

        {sortedVariables.map((v, idx) => {
          const isExpanded = expandedIds.has(v.id);
          return (
            <div
              key={v.id}
              className={`group/card border rounded-2xl overflow-hidden transition-all ${
                v.locked ? 'border-white/[0.05]' : 'border-white/[0.09]'
              }`}
              style={{ background: v.locked ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)' }}
            >
              {/* Header — always visible */}
              <div className="flex items-center gap-1 px-2.5 py-2">

                {/* Expand/collapse toggle area */}
                <button
                  onClick={() => toggle(v.id)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  {v.locked && (
                    <Lock size={11} className="text-amber-500/70 flex-shrink-0" />
                  )}
                  <span className={`flex-1 min-w-0 text-sm font-mono truncate ${v.locked ? 'text-white/40' : 'text-white'}`}>
                    {v.name || <span className="text-white/20">Unnamed</span>}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${TYPE_BADGE[v.type]}`}>
                    {TYPE_LABELS[v.type]}
                  </span>
                  {v.constant && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 bg-yellow-600/80 text-yellow-100 tracking-wide">
                      CONST
                    </span>
                  )}
                </button>

                {/* Controls — hidden when locked */}
                {!v.locked && isCustom && (
                  <>
                    <button
                      onClick={() => moveVariable(v.id, 'up')}
                      disabled={idx === 0}
                      className="text-white/40 hover:text-white disabled:opacity-20 w-5 h-5 flex items-center justify-center rounded hover:bg-white/15 transition-colors flex-shrink-0"
                      title="Move up"
                    ><ArrowUp size={12} /></button>
                    <button
                      onClick={() => moveVariable(v.id, 'down')}
                      disabled={idx === sortedVariables.length - 1}
                      className="text-white/40 hover:text-white disabled:opacity-20 w-5 h-5 flex items-center justify-center rounded hover:bg-white/15 transition-colors flex-shrink-0"
                      title="Move down"
                    ><ArrowDown size={12} /></button>
                  </>
                )}
                {!v.locked && (
                  pendingDeleteId === v.id ? (
                    <button
                      onMouseDown={(e) => handleDelete(e, v.id)}
                      className="flex-shrink-0 text-xs text-white bg-red-600 hover:bg-red-500 px-2 py-0.5 rounded-lg font-medium transition-colors"
                    >
                      Delete?
                    </button>
                  ) : (
                    <button
                      onMouseDown={(e) => handleDelete(e, v.id)}
                      className="text-white/25 hover:text-red-400 w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 transition-colors flex-shrink-0"
                    ><X size={12} /></button>
                  )
                )}

                {/* Lock / Edit button */}
                <button
                  onClick={() => handleToggleLock(v.id, v.locked)}
                  className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-lg font-medium transition-colors ${
                    v.locked
                      ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 border border-amber-700/40'
                      : 'text-white/30 hover:text-white/80 hover:bg-white/10'
                  }`}
                  title={v.locked ? 'Unlock to edit' : 'Lock variable'}
                >
                  {v.locked ? 'Edit' : 'Lock'}
                </button>

                <button
                  onClick={() => toggle(v.id)}
                  className="text-white/30 hover:text-white/70 w-5 h-5 flex items-center justify-center flex-shrink-0 transition-colors"
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {/* Hover value preview — only when collapsed */}
              {!isExpanded && (
                <div className="hidden group-hover/card:flex items-center gap-1.5 px-3 pb-2 -mt-1">
                  <span className="text-white/25 text-xs">=</span>
                  <code className="text-xs text-white/50 font-mono truncate">{formatPreview(v)}</code>
                </div>
              )}

              {/* Expanded editor */}
              {isExpanded && (
                <div className="border-t border-white/[0.06] px-3 pb-3 pt-2.5 space-y-2.5">
                  <div>
                    <label className="text-xs text-white/35 mb-1 block font-medium">Name</label>
                    <input
                      disabled={v.locked}
                      value={v.name}
                      onChange={(e) => updateVariable(v.id, { name: e.target.value })}
                      placeholder="variable_name"
                      className={`${INPUT_CLS} font-mono`}
                      spellCheck={false}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/35 mb-1 block font-medium">Type</label>
                    <select
                      disabled={v.locked}
                      value={v.type}
                      onChange={(e) => updateVariable(v.id, { type: e.target.value as PythonType })}
                      className={SELECT_CLS}
                    >
                      {PYTHON_TYPES.map((t) => (
                        <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>

                  <label className={`flex items-start gap-2.5 cursor-pointer group/const ${v.locked ? 'pointer-events-none opacity-50' : ''}`}>
                    <div className="relative flex-shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={v.constant}
                        disabled={v.locked}
                        onChange={() => updateVariable(v.id, { constant: !v.constant })}
                        className="sr-only"
                      />
                      <div className={`w-8 h-4 rounded-full transition-colors ${v.constant ? 'bg-yellow-500' : 'bg-white/20'}`} />
                      <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${v.constant ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <div>
                      <p className="text-xs text-white/70 font-medium leading-none mb-0.5">Constant</p>
                      <p className="text-xs text-white/30 leading-snug">
                        Value cannot change at runtime. Uses <code className="text-white/40">Final</code> annotation.
                      </p>
                    </div>
                  </label>
                  <div>
                    <label className="text-xs text-white/35 mb-1 block font-medium">
                      {v.type === 'list' ? 'Items' : v.type === 'dict' ? 'Entries' : 'Value'}
                    </label>
                    <ValueEditor variable={v} locked={v.locked} />
                  </div>

                  {v.locked && (
                    <button
                      onClick={() => handleToggleLock(v.id, true)}
                      className="w-full text-xs text-amber-400 hover:text-amber-300 border border-amber-700/40 hover:border-amber-600/60 rounded-xl py-1.5 transition-colors"
                    >
                      Unlock to edit
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-2 border-t border-white/[0.06] flex-shrink-0">
        <button
          onClick={addVariable}
          className="w-full text-sm text-white/35 hover:text-white/70 border border-dashed border-white/15 hover:border-white/30 rounded-2xl py-2 transition-colors"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          + Add Variable
        </button>
      </div>
    </div>
  );
}
