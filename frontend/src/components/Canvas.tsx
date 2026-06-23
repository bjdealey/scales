import { useBlockStore } from '../store/blockStore';
import BlockNode from './BlockNode';

export default function Canvas() {
  const blocks = useBlockStore((s) => s.blocks);
  const clearAll = useBlockStore((s) => s.clearAll);

  return (
    <main className="flex-1 overflow-y-auto bg-gray-950 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-gray-300">Canvas</p>
          <p className="text-xs text-gray-600">{blocks.length} block{blocks.length !== 1 ? 's' : ''}</p>
        </div>
        {blocks.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-400/10"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex-1 p-4">
        {blocks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center text-2xl mb-4">
              ⚡
            </div>
            <p className="text-gray-400 font-medium mb-1">No blocks yet</p>
            <p className="text-gray-600 text-sm max-w-xs">
              Click a block type in the left panel to start building your automation script
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
