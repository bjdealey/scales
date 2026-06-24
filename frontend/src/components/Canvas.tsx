import { useCallback, useMemo } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useBlockStore } from '../store/blockStore';
import { BlockType, BLOCK_META } from '../types';
import BlockNode, { InsertBlockMenu, AddBlockMenu } from './BlockNode';
import { buildLineMap } from '../codegen/generator';
import { LineMapContext } from '../context/LineMapContext';

function PaletteInsertIndicator({ blockType }: { blockType: BlockType }) {
  const meta = BLOCK_META[blockType];
  return (
    <div className="py-1 px-1">
      <div
        className={`border-2 border-dashed ${meta.borderColor} rounded-2xl flex items-center justify-center py-3 opacity-60`}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--tx-3)' }}>Drop {meta.label} here</span>
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
  const blocks      = useBlockStore((s) => s.blocks);
  const variables   = useBlockStore((s) => s.variables);
  const clearAll    = useBlockStore((s) => s.clearAll);
  const selectBlock = useBlockStore((s) => s.selectBlock);

  const lineMap     = useMemo(() => buildLineMap(blocks, variables), [blocks, variables]);

  const handleBackgroundClick = useCallback(() => selectBlock(null), [selectBlock]);

  const sortableIds = blocks.map((b) => b.id);
  if (paletteDragId) sortableIds.push(paletteDragId);

  const isPaletteDragging = !!paletteDragId && paletteBlockType != null;

  return (
    <LineMapContext.Provider value={lineMap}>
      <main className="flex-1 overflow-y-auto canvas-grid flex flex-col relative" onClick={handleBackgroundClick}>
        {blocks.length > 0 && (
          <button
            onClick={clearAll}
            className="absolute top-3 right-3 z-10 text-xs px-2 py-1 rounded-lg transition-colors hover:text-red-400 hover:bg-red-400/10"
            style={{ color: 'var(--tx-4)' }}
          >
            Clear all
          </button>
        )}

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
                  <p className="text-xs text-center mt-3" style={{ color: 'var(--tx-4)' }}>
                    Your Python script assembles here as you add actions
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full max-w-3xl mx-auto">
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                {isPaletteDragging && paletteInsertIndex === 0 && (
                  <PaletteInsertIndicator blockType={paletteBlockType!} />
                )}

                {blocks.map((block, i) => (
                  <div key={block.id}>
                    <BlockNode block={block} />
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
    </LineMapContext.Provider>
  );
}
