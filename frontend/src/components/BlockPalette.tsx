import { useState } from 'react';
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

const BLOCK_ICONS: Record<BlockType, string> = {
  http_request: '🌐',
  set_variable: '📦',
  for_each: '🔄',
  if_condition: '❓',
  print: '🖨',
  file_write: '💾',
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

export default function BlockPalette() {
  const [tab, setTab] = useState<Tab>('variables');
  const addBlock = useBlockStore((s) => s.addBlock);
  const variableCount = useBlockStore((s) => s.variables.length);

  return (
    <aside className="w-full h-full bg-gray-900 flex flex-col overflow-hidden">
      <div className="flex flex-shrink-0 border-b border-gray-700">
        {(['variables', 'blocks'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
              tab === t
                ? 'text-white bg-gray-800 border-b-2 border-blue-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t}
            {t === 'variables' && variableCount > 0 && (
              <span className="ml-1.5 text-xs bg-gray-700 text-gray-400 rounded-full px-1.5 py-0.5">
                {variableCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'variables' ? (
        <VariablesPanel />
      ) : (
        <>
          <div className="px-3 py-2 border-b border-gray-700 flex-shrink-0">
            <p className="text-xs text-gray-600">Click to add to canvas</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {BLOCK_TYPES.map((type) => {
              const meta = BLOCK_META[type];
              return (
                <button
                  key={type}
                  onClick={() => addBlock(type)}
                  className="w-full text-left rounded-lg overflow-hidden border border-gray-700 hover:border-gray-500 transition-colors group"
                >
                  <div className={`${meta.color} px-2.5 py-1.5 flex items-center gap-2`}>
                    <span className="text-sm">{BLOCK_ICONS[type]}</span>
                    <span className="text-white text-xs font-semibold">{meta.label}</span>
                  </div>
                  <div className="bg-gray-800 px-2.5 py-1">
                    <p className="text-gray-500 text-xs">{BLOCK_DESCRIPTIONS[type]}</p>
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
