import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, ChevronDown, Plus, X } from 'lucide-react';
import { Block, BlockType, BLOCK_META, PythonType, TYPE_LABELS } from '../types';
import { useBlockStore } from '../store/blockStore';

const BLOCK_TYPES: BlockType[] = [
  'http_request', 'set_variable', 'for_each', 'if_condition', 'print', 'file_write',
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

const INPUT_CLS =
  'bg-white/[0.08] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-400/70 w-full font-mono placeholder-white/25';

const LABEL_CLS = 'text-white/40 text-xs w-20 flex-shrink-0';
const ROW_CLS   = 'flex items-center gap-2';

const DROPDOWN_STYLE: React.CSSProperties = {
  background: 'rgba(3,7,18,0.97)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: '0 16px 32px rgba(0,0,0,0.7)',
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
        className={`flex items-center rounded-lg text-xs transition-all ${
          isVarRef
            ? 'bg-violet-950/40 border border-violet-500/40'
            : 'bg-white/[0.08] border border-white/10 hover:bg-white/[0.12]'
        }`}
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
          className="flex-1 min-w-0 bg-transparent px-2 py-1 text-white placeholder-white/25 focus:outline-none font-mono"
          spellCheck={false}
        />
        {/* Type badge when matched */}
        {isVarRef && matchedVar && (
          <span className={`text-[10px] px-1 py-px rounded-full font-medium flex-shrink-0 mr-1 ${TYPE_BADGE[matchedVar.type]}`}>
            {TYPE_LABELS[matchedVar.type]}
          </span>
        )}
        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); setCreating(false); }}
            className={`flex-shrink-0 px-1.5 py-1 transition-colors ${
              isVarRef
                ? 'text-violet-400/50 hover:text-red-400 border-l border-violet-500/20'
                : 'text-white/25 hover:text-red-400 border-l border-white/10'
            }`}
          >
            <X size={10} />
          </button>
        )}
        {!value && (
          <ChevronDown size={10} className="flex-shrink-0 mr-2 text-white/20" />
        )}
      </div>

      {/* Dropdown portal */}
      <DropdownPortal anchorRef={anchorRef} contentRef={contentRef} open={open}>
        <div className="rounded-xl overflow-hidden" style={DROPDOWN_STYLE}>

          {/* Variable list */}
          {filtered.length > 0 && (
            <div className={`py-1 max-h-44 overflow-y-auto ${showCreate ? 'border-b border-white/[0.06]' : ''}`}>
              {filtered.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleSelect(v.name)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                    v.name === value ? 'bg-white/[0.10]' : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <span className={`text-[10px] px-1.5 py-px rounded-full font-medium flex-shrink-0 ${TYPE_BADGE[v.type]}`}>
                    {TYPE_LABELS[v.type]}
                  </span>
                  <span className="text-xs font-mono text-white">{v.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Empty states */}
          {filtered.length === 0 && !value.trim() && (
            <p className="px-3 py-2.5 text-[11px] text-white/25 text-center">
              {compatible.length === 0
                ? 'No variables yet — add some in the Variables tab'
                : 'No matching variables'}
            </p>
          )}
          {filtered.length === 0 && value.trim() && !isVarRef && (
            <p className="px-3 py-2 text-[11px] text-white/25">No matching variables</p>
          )}

          {/* Save as variable option */}
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
                  className="flex-1 bg-white/[0.08] border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder-white/25 focus:outline-none focus:border-blue-400/70 font-mono"
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
                <button type="button" onClick={cancelCreate} className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setCreating(true); setNewVarName(''); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-blue-400/80 hover:text-blue-300 hover:bg-white/[0.04] transition-colors text-[11px]"
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
        className={`flex items-center rounded-lg text-xs transition-all ${
          exists
            ? 'bg-violet-950/40 border border-violet-500/40'
            : 'bg-white/[0.08] border border-white/10 hover:bg-white/[0.12]'
        }`}
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
          className="flex-1 min-w-0 bg-transparent px-2 py-1 text-white placeholder-white/25 focus:outline-none font-mono"
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
            className={`flex-shrink-0 px-1.5 py-1 transition-colors ${
              exists
                ? 'text-violet-400/50 hover:text-red-400 border-l border-violet-500/20'
                : 'text-white/25 hover:text-red-400 border-l border-white/10'
            }`}
          >
            <X size={10} />
          </button>
        )}
        {!value && <ChevronDown size={10} className="flex-shrink-0 mr-2 text-white/20" />}
      </div>

      <DropdownPortal anchorRef={anchorRef} contentRef={contentRef} open={open}>
        <div className="rounded-xl overflow-hidden" style={DROPDOWN_STYLE}>
          {filtered.length > 0 && (
            <div className={`py-1 max-h-44 overflow-y-auto ${showCreate ? 'border-b border-white/[0.06]' : ''}`}>
              {filtered.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleSelect(v.name)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                    v.name === value ? 'bg-white/[0.10]' : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <span className={`text-[10px] px-1.5 py-px rounded-full font-medium flex-shrink-0 ${TYPE_BADGE[v.type]}`}>
                    {TYPE_LABELS[v.type]}
                  </span>
                  <span className="text-xs font-mono text-white">{v.name}</span>
                </button>
              ))}
            </div>
          )}
          {filtered.length === 0 && !value.trim() && (
            <p className="px-3 py-2.5 text-[11px] text-white/25 text-center">
              {named.length === 0 ? 'No variables yet' : 'No matching variables'}
            </p>
          )}
          {showCreate && (
            <button
              type="button"
              onClick={handleCreate}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-blue-400/80 hover:text-blue-300 hover:bg-white/[0.04] transition-colors text-[11px]"
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

function AddBlockMenu({ parentId, inElse }: { parentId?: string; inElse?: boolean }) {
  const [open, setOpen] = useState(false);
  const addBlock = useBlockStore((s) => s.addBlock);

  return (
    <div className="mt-1.5">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full text-xs text-white/25 hover:text-white/60 border border-dashed border-white/15 hover:border-white/30 rounded-xl px-2 py-1 transition-colors text-left"
        >
          + Add scale{inElse ? ' (else)' : ''}
        </button>
      ) : (
        <div
          className="rounded-2xl p-2 backdrop-blur-sm"
          style={{ border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(3,7,18,0.85)' }}
        >
          <div className="flex flex-wrap gap-1 mb-2">
            {BLOCK_TYPES.map((type) => {
              const meta = BLOCK_META[type];
              return (
                <button
                  key={type}
                  onClick={() => { addBlock(type, parentId, inElse); setOpen(false); }}
                  className={`${meta.color} text-white text-xs px-2 py-0.5 rounded-lg hover:opacity-80 transition-opacity`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Cancel
          </button>
        </div>
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
      return (
        <div className="space-y-1.5 mt-2">
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Method</span>
            <select value={block.params.method || 'GET'} onChange={up('method')} className={INPUT_CLS}>
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>URL</span>
            <SmartField
              value={block.params.url || ''}
              onChange={(v) => set('url', v)}
              types={['str', 'Any']}
              placeholder="api.example.com/v1/endpoint"
            />
          </div>
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Save as</span>
            <OutputVarField
              value={block.params.varName || ''}
              onChange={(v) => set('varName', v)}
              suggestedType="Any"
            />
          </div>
          {['POST', 'PUT', 'PATCH'].includes(block.params.method || 'GET') && (
            <div className={ROW_CLS}>
              <span className={LABEL_CLS}>Body</span>
              <SmartField
                value={block.params.body || ''}
                onChange={(v) => set('body', v)}
                types={['dict', 'Any']}
                placeholder='{"key": "value"}'
              />
            </div>
          )}
        </div>
      );

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
        <div className={`${ROW_CLS} mt-2`}>
          <span className="text-white/35 text-xs font-mono flex-shrink-0">if</span>
          <SmartField
            value={block.params.condition || ''}
            onChange={(v) => set('condition', v)}
            types={['bool', 'Any']}
            placeholder="response.ok"
          />
          <span className="text-white/35 text-xs font-mono flex-shrink-0">:</span>
        </div>
      );

    case 'print':
      return (
        <div className={`${ROW_CLS} mt-2`}>
          <span className="text-white/35 text-xs font-mono flex-shrink-0">print(</span>
          <SmartField
            value={block.params.expression || ''}
            onChange={(v) => set('expression', v)}
            placeholder="Hello, world!"
          />
          <span className="text-white/35 text-xs font-mono flex-shrink-0">)</span>
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

    default:
      return null;
  }
}

export default function BlockNode({ block, depth = 0 }: { block: Block; depth?: number }) {
  const removeBlock = useBlockStore((s) => s.removeBlock);
  const moveBlock   = useBlockStore((s) => s.moveBlock);
  const meta        = BLOCK_META[block.type];

  return (
    <div className="my-1">
      <div
        className={`rounded-2xl border ${meta.borderColor} overflow-hidden`}
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        <div className={`${meta.color} px-3 py-1.5 flex items-center justify-between`}>
          <span className="text-white font-semibold text-xs uppercase tracking-wider">
            {meta.label}
          </span>
          <div className="flex items-center gap-0.5">
            <button onClick={() => moveBlock(block.id, 'up')} title="Move up"
              className="text-white/50 hover:text-white w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition-colors">
              <ArrowUp size={12} />
            </button>
            <button onClick={() => moveBlock(block.id, 'down')} title="Move down"
              className="text-white/50 hover:text-white w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition-colors">
              <ArrowDown size={12} />
            </button>
            <button onClick={() => removeBlock(block.id)} title="Remove block"
              className="text-white/50 hover:text-red-300 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition-colors ml-1">
              <X size={12} />
            </button>
          </div>
        </div>

        <div className="px-3 pb-3">
          <BlockParams block={block} />

          {meta.isContainer && (
            <div className="mt-3 pl-3 border-l border-white/15">
              <p className="text-xs text-white/30 mb-1 font-mono">do:</p>
              {block.children.map((child) => (
                <BlockNode key={child.id} block={child} depth={depth + 1} />
              ))}
              <AddBlockMenu parentId={block.id} />
            </div>
          )}

          {block.type === 'if_condition' && (
            <div className="mt-3 pl-3 border-l border-white/15">
              <p className="text-xs text-white/30 mb-1 font-mono">else: (optional)</p>
              {block.elseChildren.map((child) => (
                <BlockNode key={child.id} block={child} depth={depth + 1} />
              ))}
              <AddBlockMenu parentId={block.id} inElse={true} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
