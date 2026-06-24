import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useBlockStore } from '../store/blockStore';
import { BlockType, BLOCK_META } from '../types';
import BlockNode, { InsertBlockMenu, AddBlockMenu } from './BlockNode';

function PaletteInsertIndicator({ blockType }: { blockType: BlockType }) {
  const meta = BLOCK_META[blockType];
  return (
    <div className="py-1 px-1">
      <div
        className={`border-2 border-dashed ${meta.borderColor} rounded-2xl flex items-center justify-center py-3 opacity-60`}
      >
        <span className="text-white/50 text-xs font-medium">Drop {meta.label} here</span>
      </div>
    </div>
  );
}

interface CanvasProps {
  paletteDragId?: string | null;
  paletteInsertIndex?: number | null;
  paletteBlockType?: BlockType | null;
}

export default function Canvas({ paletteDragId, paletteInsertIndex, paletteBlockType }: CanvasProps) {
  const blocks   = useBlockStore((s) => s.blocks);
  const clearAll = useBlockStore((s) => s.clearAll);

  // Include the palette draggable ID at the end so blocks animate around it
  const sortableIds = blocks.map((b) => b.id);
  if (paletteDragId) sortableIds.push(paletteDragId);

  const isPaletteDragging = !!paletteDragId && paletteBlockType != null;

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
            {isPaletteDragging ? (
              <div className="w-full max-w-3xl">
                <PaletteInsertIndicator blockType={paletteBlockType!} />
              </div>
            ) : (
              <div className="w-full max-w-xs">
                <AddBlockMenu />
                <p className="text-white/25 text-xs text-center mt-3">
                  Your Python script assembles here as you add actions
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full max-w-3xl mx-auto">
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {/* Insert indicator at top */}
              {isPaletteDragging && paletteInsertIndex === 0 && (
                <PaletteInsertIndicator blockType={paletteBlockType!} />
              )}

              {blocks.map((block, i) => (
                <div key={block.id}>
                  <BlockNode block={block} />

                  {/* After each block: either the palette insert indicator or the normal insert menu */}
                  {isPaletteDragging
                    ? paletteInsertIndex === i + 1
                      ? <PaletteInsertIndicator blockType={paletteBlockType!} />
                      : <div className="h-2" />
                    : <InsertBlockMenu index={i + 1} />
                  }
                </div>
              ))}
            </SortableContext>
          </div>
        )}
      </div>
    </main>
  );
}
