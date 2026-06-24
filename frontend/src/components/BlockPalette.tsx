import { useState } from 'react';
import { Globe, Package, Repeat2, GitBranch, Terminal, FileOutput, type LucideIcon } from 'lucide-react';
import { BlockType, BLOCK_META } from '../types';
import { useBlockStore } from '../store/blockStore';
import VariablesPanel from './VariablesPanel';

const BLOCK_DESCRIPTIONS: Record<BlockType, string> = {
  http_request: 'GET, POST, PUT, DELETE',
  set_variable: 'assign mid-flow',
  for_each: 'loop over a list',
  if_condition: 'branch on condition',
  print: 'output to console',
  file_write: 'write to a file',
};

const BLOCK_ICONS: Record<BlockType, LucideIcon> = {
  http_request: Globe,
  set_variable: Package,
  for_each: Repeat2,
  if_condition: GitBranch,
  print: Terminal,
  file_write: FileOutput,
};

const BLOCK_TYPES: BlockType[] = [
  'http_request',
  'set_variable',
  'for_each',
  'if_condition',
  'print',
  'file_write',
];

type Tab = 'blocks' | 'variables';

const TAB_LABELS: Record<Tab, string> = {
  variables: 'Variables',
  blocks: 'Scales',
};

export default function BlockPalette() {
  const [tab, setTab] = useState<Tab>('variables');
  const addBlock = useBlockStore((s) => s.addBlock);
  const variableCount = useBlockStore((s) => s.variables.length);

  return (
    <aside className="w-full h-full bg-gray-950 flex flex-col overflow-hidden">
      {/* iOS 26-style segment control */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2">
        <div
          className="flex p-1 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {(['variables', 'blocks'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[10px] text-xs font-medium transition-all duration-200 ${
                tab === t ? 'text-white' : 'text-white/40 hover:text-white/60'
              }`}
              style={tab === t ? {
                background: 'rgba(255,255,255,0.15)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
              } : undefined}
            >
              {TAB_LABELS[t]}
              {t === 'variables' && variableCount > 0 && (
                <span className={`text-[10px] rounded-full px-1.5 py-0.5 leading-none ${
                  tab === t ? 'bg-white/20 text-white' : 'bg-white/10 text-white/40'
                }`}>
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
            <p className="text-xs text-white/25">Click a scale to add it to your script</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
            {BLOCK_TYPES.map((type) => {
              const meta = BLOCK_META[type];
              return (
                <button
                  key={type}
                  onClick={() => addBlock(type)}
                  className="w-full text-left rounded-2xl overflow-hidden transition-all duration-150"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className={`${meta.color} px-3 py-2 flex items-center gap-2`}>
                    {(() => { const Icon = BLOCK_ICONS[type]; return <Icon size={14} className="text-white flex-shrink-0" />; })()}
                    <span className="text-white text-xs font-semibold">{meta.label}</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)' }} className="px-3 py-1.5">
                    <p className="text-white/35 text-xs">{BLOCK_DESCRIPTIONS[type]}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
}
