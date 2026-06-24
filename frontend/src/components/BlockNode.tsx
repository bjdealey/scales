import { useState } from 'react';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { Block, BlockType, BLOCK_META } from '../types';
import { useBlockStore } from '../store/blockStore';

const BLOCK_TYPES: BlockType[] = [
  'http_request',
  'set_variable',
  'for_each',
  'if_condition',
  'print',
  'file_write',
];

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
                  onClick={() => {
                    addBlock(type, parentId, inElse);
                    setOpen(false);
                  }}
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

const INPUT_CLS =
  'bg-white/[0.08] border border-white/10 rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-blue-400/70 w-full font-mono placeholder-white/25';
const LABEL_CLS = 'text-white/40 text-xs w-20 flex-shrink-0';
const ROW_CLS = 'flex items-center gap-2';

function BlockParams({ block }: { block: Block }) {
  const updateBlock = useBlockStore((s) => s.updateBlock);
  const up = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    updateBlock(block.id, { [key]: e.target.value });

  switch (block.type) {
    case 'http_request':
      return (
        <div className="space-y-1.5 mt-2">
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Method</span>
            <select value={block.params.method || 'GET'} onChange={up('method')} className={INPUT_CLS}>
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>URL</span>
            <input
              value={block.params.url || ''}
              onChange={up('url')}
              className={INPUT_CLS}
              placeholder='"https://api.example.com"'
            />
          </div>
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Save as</span>
            <input
              value={block.params.varName || ''}
              onChange={up('varName')}
              className={INPUT_CLS}
              placeholder='response'
            />
          </div>
          {['POST', 'PUT', 'PATCH'].includes(block.params.method || 'GET') && (
            <div className={ROW_CLS}>
              <span className={LABEL_CLS}>Body</span>
              <input
                value={block.params.body || ''}
                onChange={up('body')}
                className={INPUT_CLS}
                placeholder='{"key": "value"}'
              />
            </div>
          )}
        </div>
      );

    case 'set_variable':
      return (
        <div className="flex items-center gap-1.5 mt-2">
          <input
            value={block.params.name || ''}
            onChange={up('name')}
            className={`${INPUT_CLS} w-28`}
            placeholder='variable_name'
          />
          <span className="text-white/35 text-xs font-mono">=</span>
          <input
            value={block.params.value || ''}
            onChange={up('value')}
            className={INPUT_CLS}
            placeholder='"value" or expression'
          />
        </div>
      );

    case 'for_each':
      return (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-white/35 text-xs font-mono">for</span>
          <input
            value={block.params.itemVar || ''}
            onChange={up('itemVar')}
            className={`${INPUT_CLS} w-24`}
            placeholder='item'
          />
          <span className="text-white/35 text-xs font-mono">in</span>
          <input
            value={block.params.iterable || ''}
            onChange={up('iterable')}
            className={`${INPUT_CLS} flex-1 min-w-0`}
            placeholder='response.json()'
          />
        </div>
      );

    case 'if_condition':
      return (
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-white/35 text-xs font-mono">if</span>
          <input
            value={block.params.condition || ''}
            onChange={up('condition')}
            className={`${INPUT_CLS} flex-1`}
            placeholder='condition or expression'
          />
          <span className="text-white/35 text-xs font-mono">:</span>
        </div>
      );

    case 'print':
      return (
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-white/35 text-xs font-mono">print(</span>
          <input
            value={block.params.expression || ''}
            onChange={up('expression')}
            className={`${INPUT_CLS} flex-1`}
            placeholder='"Hello!" or variable'
          />
          <span className="text-white/35 text-xs font-mono">)</span>
        </div>
      );

    case 'file_write':
      return (
        <div className="space-y-1.5 mt-2">
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Path</span>
            <input
              value={block.params.path || ''}
              onChange={up('path')}
              className={INPUT_CLS}
              placeholder='"output.txt"'
            />
          </div>
          <div className={ROW_CLS}>
            <span className={LABEL_CLS}>Content</span>
            <input
              value={block.params.content || ''}
              onChange={up('content')}
              className={INPUT_CLS}
              placeholder='my_variable or expression'
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
  const moveBlock = useBlockStore((s) => s.moveBlock);
  const meta = BLOCK_META[block.type];

  return (
    <div className={`my-1 ${depth > 0 ? '' : ''}`}>
      <div className={`rounded-2xl border ${meta.borderColor} overflow-hidden`} style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div className={`${meta.color} px-3 py-1.5 flex items-center justify-between`}>
          <span className="text-white font-semibold text-xs uppercase tracking-wider">
            {meta.label}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => moveBlock(block.id, 'up')}
              title="Move up"
              className="text-white/50 hover:text-white w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition-colors"
            >
              <ArrowUp size={12} />
            </button>
            <button
              onClick={() => moveBlock(block.id, 'down')}
              title="Move down"
              className="text-white/50 hover:text-white w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition-colors"
            >
              <ArrowDown size={12} />
            </button>
            <button
              onClick={() => removeBlock(block.id)}
              title="Remove block"
              className="text-white/50 hover:text-red-300 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition-colors ml-1"
            >
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
