import { useState } from 'react';
import { Globe, Hash, Package, Repeat2, GitBranch, Terminal, FileOutput, type LucideIcon } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { BlockType, BLOCK_META } from '../types';
import { useBlockStore } from '../store/blockStore';
import VariablesPanel from './VariablesPanel';

export const BLOCK_DESCRIPTIONS: Record<BlockType, string> = {
  http_request: 'GET, POST, PUT, DELETE',
  set_variable: 'assign mid-flow',
  for_each: 'loop over a list',
  if_condition: 'branch on condition',
  print: 'output to console',
  file_write: 'write to a file',
  comment: 'add a note in the code',
};

export const BLOCK_ICONS: Record<BlockType, LucideIcon> = {
  http_request: Globe,
  set_variable: Package,
  for_each: Repeat2,
  if_condition: GitBranch,
  print: Terminal,
  file_write: FileOutput,
  comment: Hash,
};

const BLOCK_TYPES: BlockType[] = [
  'http_request',
  'set_variable',
  'for_each',
  'if_condition',
  'print',
  'file_write',
  'comment',
];

type Tab = 'blocks' | 'variables';

const TAB_LABELS: Record<Tab, string> = {
  variables: 'Variables',
  blocks: 'Actions',
};

function DraggablePaletteItem({ type }: { type: BlockType }) {
  const addBlock = useBlockStore((s) => s.addBlock);
  const meta = BLOCK_META[type];
  const Icon = BLOCK_ICONS[type];

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { type: 'palette-action', blockType: type },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
    >
      <button
        onClick={() => addBlock(type)}
        className="w-full text-left rounded-2xl overflow-hidden transition-all duration-150"
        style={{ border: '1px solid var(--brd)' }}
      >
        <div className={`${meta.color} px-3 py-2 flex items-center gap-2`}>
          <Icon size={14} className="text-white flex-shrink-0" />
          <span className="text-white text-xs font-semibold">{meta.label}</span>
        </div>
        <div style={{ background: 'var(--surface)' }} className="px-3 py-1.5">
          <p className="text-xs" style={{ color: 'var(--tx-3)' }}>{BLOCK_DESCRIPTIONS[type]}</p>
        </div>
      </button>
    </div>
  );
}

export default function BlockPalette() {
  const [tab, setTab] = useState<Tab>('variables');
  const variableCount = useBlockStore((s) => s.variables.length);

  return (
    <aside className="w-full h-full flex flex-col overflow-hidden" style={{ background: 'var(--elevated)' }}>
      {/* Segment control */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2">
        <div
          className="flex p-1 rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--brd)' }}
        >
          {(['variables', 'blocks'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[10px] text-xs font-medium transition-all duration-200"
              style={tab === t
                ? { background: 'var(--elevated)', color: 'var(--tx)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                : { color: 'var(--tx-3)' }
              }
            >
              {TAB_LABELS[t]}
              {t === 'variables' && variableCount > 0 && (
                <span className="text-[10px] rounded-full px-1.5 py-0.5 leading-none" style={{ background: 'var(--surface2)', color: 'var(--tx-2)' }}>
                  {variableCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === 'variables' ? (
        <VariablesPanel />
      ) : (
        <>
          <div className="px-3 pb-2 flex-shrink-0">
            <p className="text-xs" style={{ color: 'var(--tx-3)' }}>Click or drag an action into your script</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
            {BLOCK_TYPES.map((type) => (
              <DraggablePaletteItem key={type} type={type} />
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
