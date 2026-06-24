import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, ChevronDown, Plus, X } from 'lucide-react';
import { Block, BlockType, BLOCK_META, PythonType, TYPE_LABELS } from '../types';
import { useBlockStore } from '../store/blockStore';

const BLOCK_TYPES: BlockType[] = [
  'http_request',
  'set_variable',
  'for_each',
  'if_condition',
  'print',
  'file_write',
];

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

type FieldMode = 'var' | 'literal';

const INPUT_CLS =
  'bg-white/[0.08] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-400/70 w-full font-mono placeholder-white/25';

const LABEL_CLS = 'text-white/40 text-xs w-20 flex-shrink-0';
const ROW_CLS = 'flex items-center gap-2';

// Renders children into document.body at a fixed position relative to an anchor element.
// Escapes both overflow:hidden cards and overflow-y:auto scroll containers.
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
    // Re-position on any scroll or resize so the dropdown tracks the trigger
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
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        zIndex: 9999,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

const DROPDOWN_STYLE: React.CSSProperties = {
  background: 'rgba(3,7,18,0.97)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: '0 16px 32px rgba(0,0,0,0.7)',
  backdropFilter: 'blur(16px)',
};

// Dropdown that lists existing variables filtered by type
function VarPicker({
  value,
  onChange,
  types,
  placeholder = 'Pick a variable…',
}: {
  value: string;
  onChange: (name: string) => void;
  types?: PythonType[];
  placeholder?: string;
}) {
  const variables = useBlockStore((s) => s.variables);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const filtered = variables.filter(
    (v) => v.name.trim() && (!types || types.includes(v.type)),
  );
  const selected = filtered.find((v) => v.name === value);

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
      {/* Styled container holding the trigger + optional × — avoids button-in-button */}
      <div
        className={`flex items-center bg-white/[0.08] border rounded-lg text-xs transition-colors ${
          open ? 'border-blue-400/70' : 'border-white/10 hover:bg-white/[0.12]'
        } ${selected ? 'text-white' : 'text-white/30'}`}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 flex-1 min-w-0 px-2 py-1 focus:outline-none"
        >
          {selected ? (
            <>
              <span className={`text-[10px] px-1 py-px rounded-full font-medium flex-shrink-0 ${TYPE_BADGE[selected.type]}`}>
                {TYPE_LABELS[selected.type]}
              </span>
              <span className="font-mono flex-1 text-left truncate min-w-0">{selected.name}</span>
            </>
          ) : (
            <span className="flex-1 text-left">{placeholder}</span>
          )}
          <ChevronDown size={10} className="flex-shrink-0 text-white/30" />
        </button>
        {selected && (
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            title="Remove variable"
            className="flex-shrink-0 px-1.5 py-1 text-white/25 hover:text-red-400 transition-colors border-l border-white/10"
          >
            <X size={10} />
          </button>
        )}
      </div>

      <DropdownPortal anchorRef={anchorRef} contentRef={contentRef} open={open}>
        <div className="rounded-xl overflow-hidden" style={DROPDOWN_STYLE}>
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-[11px] text-white/30 text-center leading-relaxed">
              {variables.filter((v) => v.name.trim()).length === 0
                ? 'No variables yet — add some in the Variables tab'
                : 'No variables of the right type'}
            </p>
          ) : (
            <div className="py-1 max-h-48 overflow-y-auto">
              {filtered.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { onChange(v.name); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
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
        </div>
      </DropdownPortal>
    </div>
  );
}

// Value-mode input that offers to save its content as a new variable
function ValInputWithSaveAs({
  value,
  onChange,
  onCreateVar,
  placeholder,
  suggestedType = 'str',
}: {
  value: string;
  onChange: (v: string) => void;
  onCreateVar: (name: string) => void;
  placeholder?: string;
  suggestedType?: PythonType;
}) {
  const addVariableWithName = useBlockStore((s) => s.addVariableWithName);
  const [naming, setNaming] = useState(false);
  const [varName, setVarName] = useState('');

  const handleCreate = () => {
    if (!varName.trim()) return;
    // Pass the current literal value so the new variable is pre-filled
    addVariableWithName(varName.trim(), suggestedType, value.trim());
    onCreateVar(varName.trim());
    setNaming(false);
    setVarName('');
  };

  const cancel = () => { setNaming(false); setVarName(''); };

  if (naming) {
    return (
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <input
          autoFocus
          value={varName}
          onChange={(e) => setVarName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
            if (e.key === 'Escape') cancel();
          }}
          placeholder="variable_name"
          className={`${INPUT_CLS} flex-1 font-mono`}
          spellCheck={false}
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={!varName.trim()}
          className="text-[11px] px-2 py-1 rounded-lg bg-blue-600/60 hover:bg-blue-500/80 disabled:opacity-40 text-white flex-shrink-0 font-medium border border-blue-500/40 transition-colors"
        >
          Save
        </button>
        <button
          type="button"
          onClick={cancel}
          className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${INPUT_CLS} flex-1`}
      />
      {value.trim() && (
        <button
          type="button"
          onClick={() => setNaming(true)}
          title="Save as a variable"
          className="flex-shrink-0 text-[10px] font-medium px-1.5 py-px rounded-md border bg-white/[0.06] border-white/10 text-white/30 hover:text-white/60 hover:bg-white/10 transition-all whitespace-nowrap"
        >
          + var
        </button>
      )}
    </div>
  );
}

// For "save as" / output variable name fields — existing vars + "+ Create" button
function OutputVarField({
  value,
  onChange,
  suggestedType = 'Any',
}: {
  value: string;
  onChange: (name: string) => void;
  suggestedType?: PythonType;
}) {
  const variables = useBlockStore((s) => s.variables);
  const addVariableWithName = useBlockStore((s) => s.addVariableWithName);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const named = variables.filter((v) => v.name.trim());
  const exists = named.some((v) => v.name === value.trim());

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
      <div className="flex gap-1.5">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => named.length > 0 && setOpen(true)}
          placeholder="variable_name"
          className={`${INPUT_CLS} flex-1`}
          spellCheck={false}
        />
        {!exists && value.trim() && (
          <button
            type="button"
            onClick={() => { addVariableWithName(value.trim(), suggestedType); setOpen(false); }}
            title={`Create "${value.trim()}" as a ${suggestedType} variable`}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-blue-600/60 hover:bg-blue-500/80 text-white transition-colors flex-shrink-0 font-medium border border-blue-500/40"
          >
            <Plus size={10} />
            Create
          </button>
        )}
      </div>

      <DropdownPortal anchorRef={anchorRef} contentRef={contentRef} open={open}>
        <div className="rounded-xl overflow-hidden" style={DROPDOWN_STYLE}>
          <div className="py-1 max-h-48 overflow-y-auto">
            {named.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => { onChange(v.name); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
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
          <button onClick={() => setOpen(false)} className="text-xs text-white/30 hover:text-white/60 transition-colors">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function BlockParams({ block }: { block: Block }) {
  const updateBlock = useBlockStore((s) => s.updateBlock);

  const up = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    updateBlock(block.id, { [key]: e.target.value });

  const set = (key: string, val: string) => updateBlock(block.id, { [key]: val });

  const getMode = (fieldName: string, def: FieldMode): FieldMode =>
    (block.params[`${fieldName}_mode`] as FieldMode) || def;

  const modeBtn = (fieldName: string, def: FieldMode) => {
    const cur = getMode(fieldName, def);
    return (
      <button
        type="button"
        title={cur === 'var' ? 'Switch to value input' : 'Switch to variable picker'}
        onClick={() => {
          const next: FieldMode = cur === 'var' ? 'literal' : 'var';
          updateBlock(block.id, { [`${fieldName}_mode`]: next, [fieldName]: '' });
        }}
        className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-px rounded-md transition-all border ${
          cur === 'var'
            ? 'bg-violet-600/25 border-violet-500/35 text-violet-300'
            : 'bg-white/[0.06] border-white/10 text-white/30 hover:text-white/60'
        }`}
      >
        {cur === 'var' ? 'var' : 'val'}
      </button>
    );
  };

  const varOrInput = (
    fieldName: string,
    def: FieldMode,
    opts: { types?: PythonType[]; placeholder?: string; suggestedType?: PythonType } = {},
  ) => {
    if (getMode(fieldName, def) === 'var') {
      return (
        <VarPicker
          value={block.params[fieldName] || ''}
          onChange={(v) => set(fieldName, v)}
          types={opts.types}
          placeholder={opts.placeholder}
        />
      );
    }
    return (
      <ValInputWithSaveAs
        value={block.params[fieldName] || ''}
        onChange={(v) => set(fieldName, v)}
        onCreateVar={(name) =>
          updateBlock(block.id, { [`${fieldName}_mode`]: 'var', [fieldName]: name })
        }
        placeholder={opts.placeholder}
        suggestedType={opts.suggestedType || 'str'}
      />
    );
  };

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
            {modeBtn('url', 'literal')}
            {varOrInput('url', 'literal', { types: ['str', 'Any'], placeholder: 'api.example.com/v1/endpoint', suggestedType: 'str' })}
          </div>
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Save as</span>
            <OutputVarField value={block.params.varName || ''} onChange={(v) => set('varName', v)} suggestedType="Any" />
          </div>
          {['POST', 'PUT', 'PATCH'].includes(block.params.method || 'GET') && (
            <div className={ROW_CLS}>
              <span className={LABEL_CLS}>Body</span>
              {modeBtn('body', 'var')}
              {varOrInput('body', 'var', { types: ['dict', 'Any'], placeholder: '{"key": "value"}', suggestedType: 'Any' })}
            </div>
          )}
        </div>
      );

    case 'set_variable':
      return (
        <div className="space-y-1.5 mt-2">
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Variable</span>
            <OutputVarField value={block.params.name || ''} onChange={(v) => set('name', v)} suggestedType="Any" />
          </div>
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Value</span>
            {modeBtn('value', 'var')}
            {varOrInput('value', 'var', { placeholder: '"hello" or expression', suggestedType: 'Any' })}
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
            {modeBtn('iterable', 'var')}
            {varOrInput('iterable', 'var', { types: ['list', 'dict', 'Any'], placeholder: 'my_list or expression', suggestedType: 'list' })}
          </div>
        </div>
      );

    case 'if_condition':
      return (
        <div className={`${ROW_CLS} mt-2`}>
          <span className="text-white/35 text-xs font-mono flex-shrink-0">if</span>
          {modeBtn('condition', 'var')}
          {varOrInput('condition', 'var', { types: ['bool', 'Any'], placeholder: 'response.ok', suggestedType: 'Any' })}
          <span className="text-white/35 text-xs font-mono flex-shrink-0">:</span>
        </div>
      );

    case 'print':
      return (
        <div className={`${ROW_CLS} mt-2`}>
          <span className="text-white/35 text-xs font-mono flex-shrink-0">print(</span>
          {modeBtn('expression', 'var')}
          {varOrInput('expression', 'var', { placeholder: 'Hello, world!', suggestedType: 'str' })}
          <span className="text-white/35 text-xs font-mono flex-shrink-0">)</span>
        </div>
      );

    case 'file_write':
      return (
        <div className="space-y-1.5 mt-2">
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Path</span>
            {modeBtn('path', 'literal')}
            {varOrInput('path', 'literal', { types: ['str', 'Any'], placeholder: 'output.txt', suggestedType: 'str' })}
          </div>
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Content</span>
            {modeBtn('content', 'var')}
            {varOrInput('content', 'var', { placeholder: 'data to write', suggestedType: 'str' })}
          </div>
        </div>
      );

    default:
      return null;
  }
}

export default function BlockNode({ block, depth = 0 }: { block: Block; depth?: number }) {
  const removeBlock = useBlockStore((s) => s.removeBlock);
  const moveBlock = useBlockStore((s) => s.moveBlock);
  const meta = BLOCK_META[block.type];

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
