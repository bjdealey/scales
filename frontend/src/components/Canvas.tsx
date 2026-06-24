import { Zap } from 'lucide-react';
import { useBlockStore } from '../store/blockStore';
import BlockNode from './BlockNode';

export default function Canvas() {
  const blocks = useBlockStore((s) => s.blocks);
  const clearAll = useBlockStore((s) => s.clearAll);

  return (
    <main className="flex-1 overflow-y-auto bg-gray-950 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-white/70">Canvas</p>
          <p className="text-xs text-white/30">{blocks.length} scale{blocks.length !== 1 ? 's' : ''}</p>
        </div>
        {blocks.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-white/30 hover:text-red-400 transition-colors px-2 py-1 rounded-xl hover:bg-red-400/10"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex-1 p-4">
        {blocks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4 border border-white/[0.10]"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <Zap size={28} className="text-white/30" />
            </div>
            <p className="text-white/50 font-semibold mb-1">No scales yet</p>
            <p className="text-white/30 text-sm max-w-xs">
              Add a scale from the left panel — your Python script assembles here as you go
            </p>
          </div>
        ) : (
          <div className="max-w-2xl">
            {blocks.map((block) => (
              <BlockNode key={block.id} block={block} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
