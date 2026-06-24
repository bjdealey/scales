import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useBlockStore } from '../store/blockStore';
import BlockNode, { InsertBlockMenu, AddBlockMenu } from './BlockNode';

export default function Canvas() {
  const blocks   = useBlockStore((s) => s.blocks);
  const clearAll = useBlockStore((s) => s.clearAll);

  return (
    <main className="flex-1 overflow-y-auto bg-gray-950 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-white/70">Canvas</p>
          <p className="text-xs text-white/30">{blocks.length} action{blocks.length !== 1 ? 's' : ''}</p>
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

      <div className="flex-1 p-6">
        {blocks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="w-full max-w-xs">
              <AddBlockMenu />
              <p className="text-white/25 text-xs text-center mt-3">
                Your Python script assembles here as you add actions
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-3xl mx-auto">
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              {blocks.map((block, i) => (
                <div key={block.id}>
                  <BlockNode block={block} />
                  <InsertBlockMenu index={i + 1} />
                </div>
              ))}
            </SortableContext>
          </div>
        )}
      </div>
    </main>
  );
}
