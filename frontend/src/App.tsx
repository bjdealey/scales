import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragCancelEvent,
  DragEndEvent,
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  Columns2,
  Download,
  FileCode2,
  FilePen,
  LayoutDashboard,
  Layers,
  Play,
  Redo2,
  Undo2,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import BlockPalette, { BLOCK_ICONS, BLOCK_DESCRIPTIONS } from './components/BlockPalette';
import Canvas from './components/Canvas';
import CodePreview from './components/CodePreview';
import BlockNode from './components/BlockNode';
import { useBlockStore } from './store/blockStore';
import { Block, BlockType, BLOCK_META } from './types';
import { generatePython } from './codegen/generator';

const LEFT_MIN = 200;
const LEFT_MAX = 560;
const RIGHT_MIN = 300;
const RIGHT_MAX = 700;
const LEFT_DEFAULT = 240;
const RIGHT_DEFAULT = 480;

type ViewMode = 'blocks' | 'split' | 'code';

const VIEW_OPTIONS: { mode: ViewMode; label: string; Icon: LucideIcon }[] = [
  { mode: 'blocks', label: 'Blocks', Icon: LayoutDashboard },
  { mode: 'split',  label: 'Split',  Icon: Columns2 },
  { mode: 'code',   label: 'Code',   Icon: FileCode2 },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="w-1 flex-shrink-0 bg-gray-800 hover:bg-blue-500 active:bg-blue-400 cursor-col-resize transition-colors select-none"
      style={{ cursor: 'col-resize' }}
    />
  );
}

type MobileTab = 'palette' | 'canvas' | 'code';

const MOBILE_TABS: { id: MobileTab; label: string; Icon: LucideIcon }[] = [
  { id: 'palette', label: 'Palette', Icon: Layers },
  { id: 'canvas',  label: 'Build',   Icon: LayoutDashboard },
  { id: 'code',    label: 'Code',    Icon: FileCode2 },
];

type ActiveItem =
  | { kind: 'block'; block: Block }
  | { kind: 'palette'; blockType: BlockType }
  | null;

function findBlockById(blocks: Block[], id: string): Block | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    const found = findBlockById(b.children, id) ?? findBlockById(b.elseChildren, id);
    if (found) return found;
  }
  return null;
}

function PaletteGhost({ blockType }: { blockType: BlockType }) {
  const meta = BLOCK_META[blockType];
  const Icon = BLOCK_ICONS[blockType];
  return (
    <div
      className="rounded-2xl overflow-hidden rotate-2 opacity-90 pointer-events-none"
      style={{ border: '1px solid rgba(255,255,255,0.08)', width: 200 }}
    >
      <div className={`${meta.color} px-3 py-2 flex items-center gap-2`}>
        <Icon size={14} className="text-white flex-shrink-0" />
        <span className="text-white text-xs font-semibold">{meta.label}</span>
      </div>
      <div style={{ background: 'rgba(20,20,28,0.95)' }} className="px-3 py-1.5">
        <p className="text-white/35 text-xs">{BLOCK_DESCRIPTIONS[blockType]}</p>
      </div>
    </div>
  );
}

export default function App() {
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<MobileTab>('canvas');
  const [viewMode, setViewMode]   = useState<ViewMode>('split');

  const [fileName, setFileName]         = useState('Untitled');
  const [editingName, setEditingName]   = useState(false);
  const [runState, setRunState]         = useState<'idle' | 'done'>('idle');

  const [leftWidth, setLeftWidth]   = useState(LEFT_DEFAULT);
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT);

  const leftWidthRef  = useRef(leftWidth);
  const rightWidthRef = useRef(rightWidth);
  leftWidthRef.current  = leftWidth;
  rightWidthRef.current = rightWidth;

  const blocks        = useBlockStore((s) => s.blocks);
  const variables     = useBlockStore((s) => s.variables);
  const addBlock      = useBlockStore((s) => s.addBlock);
  const insertBlock   = useBlockStore((s) => s.insertBlock);
  const reorderBlocks = useBlockStore((s) => s.reorderBlocks);
  const undo          = useBlockStore((s) => s.undo);
  const redo          = useBlockStore((s) => s.redo);
  const canUndo       = useBlockStore((s) => s._past.length > 0);
  const canRedo       = useBlockStore((s) => s._future.length > 0);

  // ── Drag state ───────────────────────────────────────────────────────────
  const [activeItem, setActiveItem]             = useState<ActiveItem>(null);
  const [paletteDragId, setPaletteDragId]       = useState<string | null>(null);
  const [paletteTargetIdx, setPaletteTargetIdx] = useState<number | null>(null);
  const pointerYRef = useRef(0);

  useEffect(() => {
    const track = (e: PointerEvent) => { pointerYRef.current = e.clientY; };
    window.addEventListener('pointermove', track, true);
    return () => window.removeEventListener('pointermove', track, true);
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'z' && !e.shiftKey) { undo(); e.preventDefault(); }
        if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { redo(); e.preventDefault(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // ── Export / Run ─────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const code = generatePython(blocks, variables);
    const blob = new Blob([code], { type: 'text/x-python' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${fileName.trim() || 'untitled'}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [blocks, variables, fileName]);

  const handleRun = useCallback(async () => {
    const code = generatePython(blocks, variables);
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Fallback: download the file
      const blob = new Blob([code], { type: 'text/x-python' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${fileName.trim() || 'untitled'}.py`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    setRunState('done');
    setTimeout(() => setRunState('idle'), 2000);
  }, [blocks, variables, fileName]);

  // ── Drag sensors ─────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current;
    if (data?.type === 'palette-action') {
      setPaletteDragId(e.active.id as string);
      setPaletteTargetIdx(blocks.length);
      setActiveItem({ kind: 'palette', blockType: data.blockType as BlockType });
    } else {
      const block = findBlockById(blocks, e.active.id as string);
      if (block) setActiveItem({ kind: 'block', block });
    }
  };

  const handleDragMove = (e: DragMoveEvent) => {
    if (e.active.data.current?.type !== 'palette-action') return;
    const { over } = e;
    if (!over) { setPaletteTargetIdx(blocks.length); return; }
    const overIdx = blocks.findIndex((b) => b.id === over.id);
    if (overIdx === -1) { setPaletteTargetIdx(blocks.length); return; }
    const blockMidY = over.rect.top + over.rect.height / 2;
    setPaletteTargetIdx(pointerYRef.current < blockMidY ? overIdx : overIdx + 1);
  };

  const clearPaletteDrag = () => {
    setPaletteDragId(null);
    setPaletteTargetIdx(null);
    setActiveItem(null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    const data = active.data.current;
    if (data?.type === 'palette-action') {
      const idx = paletteTargetIdx ?? blocks.length;
      clearPaletteDrag();
      if (over) {
        insertBlock(data.blockType as BlockType, idx);
      } else {
        addBlock(data.blockType as BlockType);
      }
    } else {
      setActiveItem(null);
      if (over && active.id !== over.id) {
        reorderBlocks(active.id as string, over.id as string);
      }
    }
  };

  const handleDragCancel = (_e: DragCancelEvent) => clearPaletteDrag();

  // ── Resize ───────────────────────────────────────────────────────────────
  const startLeftResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = leftWidthRef.current;
    const onMove = (ev: MouseEvent) => {
      setLeftWidth(Math.max(LEFT_MIN, Math.min(LEFT_MAX, startW + ev.clientX - startX)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const startRightResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = rightWidthRef.current;
    const onMove = (ev: MouseEvent) => {
      setRightWidth(Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, startW - (ev.clientX - startX))));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const paletteBlockType = activeItem?.kind === 'palette' ? activeItem.blockType : null;

  // ── Shared DragOverlay content ────────────────────────────────────────────
  const dragOverlayContent = (
    <DragOverlay dropAnimation={null}>
      {activeItem?.kind === 'palette' && <PaletteGhost blockType={activeItem.blockType} />}
      {activeItem?.kind === 'block' && (
        <div className="rotate-1 opacity-95 pointer-events-none">
          <BlockNode block={activeItem.block} />
        </div>
      )}
    </DragOverlay>
  );

  // ── Shared header ─────────────────────────────────────────────────────────
  function DesktopHeader() {
    return (
      <header className="h-11 bg-gray-900 border-b border-gray-700 flex items-center px-3 gap-2 flex-shrink-0 min-w-0">

        {/* Logo + file name */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center flex-shrink-0">
            <Zap size={11} className="text-white" />
          </div>
          {editingName ? (
            <input
              autoFocus
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false); }}
              className="bg-transparent text-white text-sm font-medium outline-none border-b border-white/40 w-28 pb-px"
              spellCheck={false}
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="flex items-center gap-1 text-sm font-medium text-white/80 hover:text-white transition-colors group"
              title="Rename"
            >
              <span>{fileName || 'Untitled'}</span>
              <FilePen size={11} className="text-white/30 group-hover:text-white/60 transition-colors" />
            </button>
          )}
        </div>

        {/* Export */}
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          title="Download .py file"
        >
          <Download size={13} />
          <span className="hidden sm:inline">Export</span>
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-white/10 flex-shrink-0" />

        {/* View mode segmented control */}
        <div
          className="flex p-0.5 rounded-lg flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {VIEW_OPTIONS.map(({ mode, label, Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium transition-all duration-150 ${
                viewMode === mode ? 'text-white' : 'text-white/40 hover:text-white/60'
              }`}
              style={viewMode === mode ? {
                background: 'rgba(255,255,255,0.15)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
              } : undefined}
              title={label}
            >
              <Icon size={12} />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-white/10 flex-shrink-0" />

        {/* Undo / Redo */}
        <div className="flex gap-0.5 flex-shrink-0">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            title="Undo (⌘Z)"
          >
            <Undo2 size={13} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            title="Redo (⌘⇧Z)"
          >
            <Redo2 size={13} />
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Run */}
        <button
          onClick={handleRun}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
            runState === 'done'
              ? 'bg-emerald-600 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
          title="Copy code to clipboard"
        >
          <Play size={11} className={runState === 'done' ? 'hidden' : ''} />
          <span>{runState === 'done' ? 'Copied!' : 'Run'}</span>
        </button>
      </header>
    );
  }

  /* ── Mobile layout ── */
  if (isMobile) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="h-dvh flex flex-col bg-gray-950 text-white overflow-hidden select-none">
          <header
            className="flex-shrink-0 h-14 flex items-center justify-between px-4 backdrop-blur-xl"
            style={{
              background: 'rgba(12,12,16,0.75)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', boxShadow: '0 2px 12px rgba(99,102,241,0.5)' }}
              >
                <Zap size={14} className="text-white" />
              </div>
              <span className="font-semibold text-base tracking-tight">{fileName || 'Untitled'}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={undo} disabled={!canUndo}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-white/50 disabled:opacity-25 active:bg-white/10">
                <Undo2 size={15} />
              </button>
              <button onClick={redo} disabled={!canRedo}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-white/50 disabled:opacity-25 active:bg-white/10">
                <Redo2 size={15} />
              </button>
              <button
                onClick={handleRun}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                  runState === 'done' ? 'bg-emerald-600' : 'bg-blue-600'
                } text-white`}
              >
                {runState === 'done' ? 'Copied!' : 'Run'}
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-hidden flex flex-col">
            {mobileTab === 'palette' && <BlockPalette />}
            {mobileTab === 'canvas'  && (
              <Canvas
                paletteDragId={paletteDragId}
                paletteInsertIndex={paletteTargetIdx}
                paletteBlockType={paletteBlockType}
              />
            )}
            {mobileTab === 'code'    && <CodePreview />}
          </div>

          <div
            className="flex-shrink-0 flex justify-center px-6 pt-2"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
          >
            <nav
              className="flex gap-1 p-1.5 backdrop-blur-2xl rounded-full"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
              }}
            >
              {MOBILE_TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setMobileTab(id)}
                  className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-full transition-all duration-200 ${
                    mobileTab === id ? 'text-white' : 'text-white/40'
                  }`}
                  style={mobileTab === id ? {
                    background: 'rgba(255,255,255,0.18)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
                  } : undefined}
                >
                  <Icon size={22} strokeWidth={mobileTab === id ? 2 : 1.5} />
                  <span className="text-[10px] font-medium tracking-wide">{label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {dragOverlayContent}
      </DndContext>
    );
  }

  /* ── Desktop layout ── */
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden select-none">
        <DesktopHeader />

        <div className="flex flex-1 overflow-hidden">
          {/* Palette + Canvas — hidden in code-only mode */}
          {viewMode !== 'code' && (
            <>
              <div
                className="flex-shrink-0 border-r border-gray-700 overflow-hidden"
                style={{ width: leftWidth }}
              >
                <BlockPalette />
              </div>
              <ResizeHandle onMouseDown={startLeftResize} />
              <Canvas
                paletteDragId={paletteDragId}
                paletteInsertIndex={paletteTargetIdx}
                paletteBlockType={paletteBlockType}
              />
            </>
          )}

          {/* Code preview — split or code-only */}
          {viewMode === 'split' && (
            <>
              <ResizeHandle onMouseDown={startRightResize} />
              <div
                className="flex-shrink-0 border-l border-gray-700 overflow-hidden"
                style={{ width: rightWidth }}
              >
                <CodePreview />
              </div>
            </>
          )}
          {viewMode === 'code' && (
            <div className="flex-1 overflow-hidden">
              <CodePreview />
            </div>
          )}
        </div>
      </div>

      {dragOverlayContent}
    </DndContext>
  );
}
