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
  FolderOpen,
  LayoutDashboard,
  Layers,
  Play,
  Redo2,
  Undo2,
  X,
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
import { parsePython } from './utils/pythonParser';

function getBlockIdsInOrder(blocks: Block[], collapsedBlocks: Record<string, boolean>): string[] {
  const ids: string[] = [];
  function walk(list: Block[]) {
    for (const b of list) {
      ids.push(b.id);
      if (!collapsedBlocks[b.id]) {
        walk(b.children);
        for (const br of b.elifBranches) walk(br.children);
        walk(b.elseChildren);
      }
    }
  }
  walk(blocks);
  return ids;
}

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
      className="w-1 flex-shrink-0 hover:bg-blue-500 active:bg-blue-400 cursor-col-resize transition-colors select-none"
      style={{ cursor: 'col-resize', background: 'var(--brd-med)' }}
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

  // null = still checking, true = backend found, false = no backend
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [running, setRunning]   = useState(false);
  const [runResult, setRunResult] = useState<{ stdout: string; stderr: string; returncode: number } | null>(null);
  const [copied, setCopied]     = useState(false);

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
  const loadScript    = useBlockStore((s) => s.loadScript);
  const undo          = useBlockStore((s) => s.undo);
  const redo          = useBlockStore((s) => s.redo);
  const canUndo       = useBlockStore((s) => s._past.length > 0);
  const canRedo       = useBlockStore((s) => s._future.length > 0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileOpen = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const code = await file.text();
    const result = parsePython(code);
    loadScript(result.blocks, result.variables);
    setFileName(file.name.replace(/\.py$/, ''));
  }, [loadScript]);

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
    const isEditable = (el: EventTarget | null) => {
      if (!el) return false;
      const tag = (el as HTMLElement).tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select';
    };

    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Undo / redo — always active
      if (meta && e.key === 'z' && !e.shiftKey) { undo(); e.preventDefault(); return; }
      if (meta && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) { redo(); e.preventDefault(); return; }

      // All other shortcuts require focus to be outside an input
      if (isEditable(e.target)) return;

      const s = useBlockStore.getState();
      const { selectedBlockId, clipboardBlock } = s;

      if (selectedBlockId) {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault(); s.removeBlock(selectedBlockId); s.selectBlock(null); return;
        }
        if (e.key === 'ArrowUp' && !meta) {
          e.preventDefault();
          const ids = getBlockIdsInOrder(s.blocks, s.collapsedBlocks);
          const idx = ids.indexOf(selectedBlockId);
          if (idx > 0) s.selectBlock(ids[idx - 1]);
          return;
        }
        if (e.key === 'ArrowDown' && !meta) {
          e.preventDefault();
          const ids = getBlockIdsInOrder(s.blocks, s.collapsedBlocks);
          const idx = ids.indexOf(selectedBlockId);
          if (idx < ids.length - 1) s.selectBlock(ids[idx + 1]);
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault(); s.setCollapsed(selectedBlockId, true); return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault(); s.setCollapsed(selectedBlockId, false); return;
        }
        if (meta && e.key === 'ArrowUp') {
          e.preventDefault(); s.moveBlock(selectedBlockId, 'up'); return;
        }
        if (meta && e.key === 'ArrowDown') {
          e.preventDefault(); s.moveBlock(selectedBlockId, 'down'); return;
        }
        if (meta && e.key === 'c') {
          e.preventDefault(); s.copyBlock(selectedBlockId); return;
        }
        if (meta && e.key === 'x') {
          e.preventDefault(); s.cutBlock(selectedBlockId); return;
        }
        if (e.key === 'Escape') {
          s.selectBlock(null); return;
        }
      }

      if (meta && e.key === 'v' && clipboardBlock) {
        e.preventDefault(); s.pasteBlock(); return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // ── Backend availability check ───────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    fetch('/api/run', { method: 'HEAD', signal: controller.signal })
      .then(() => setBackendAvailable(true))
      .catch((err) => { if (err.name !== 'AbortError') setBackendAvailable(false); })
      .finally(() => clearTimeout(timer));
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);

  // ── Export / Run / Copy ───────────────────────────────────────────────────
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
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      setRunResult(await res.json());
    } catch {
      setRunResult({ stdout: '', stderr: 'Could not reach the backend.', returncode: 1 });
    } finally {
      setRunning(false);
    }
  }, [blocks, variables]);

  const handleCopy = useCallback(async () => {
    const code = generatePython(blocks, variables);
    try { await navigator.clipboard.writeText(code); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [blocks, variables]);

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
      <header
        className="h-11 flex items-center px-3 gap-2 flex-shrink-0 min-w-0 border-b"
        style={{ background: 'var(--elevated)', borderColor: 'var(--brd)' }}
      >
        {/* Logo + file name */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center flex-shrink-0">
            <Zap size={11} className="text-white" />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".py"
            className="hidden"
            onChange={handleFileOpen}
          />
          {editingName ? (
            <input
              autoFocus
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false); }}
              className="bg-transparent text-sm font-medium outline-none w-28 pb-px border-b"
              style={{ color: 'var(--tx)', borderColor: 'var(--brd-med)' }}
              spellCheck={false}
            />
          ) : (
            <div className="flex items-center gap-0.5 group">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-sm font-medium transition-colors"
                style={{ color: 'var(--tx-2)' }}
                title="Open .py file"
              >
                <span>{fileName || 'Untitled'}</span>
                <FolderOpen size={11} style={{ color: 'var(--tx-4)' }} className="group-hover:opacity-70 transition-opacity" />
              </button>
              <button
                onClick={() => setEditingName(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
                title="Rename"
              >
                <FilePen size={11} style={{ color: 'var(--tx-3)' }} />
              </button>
            </div>
          )}
        </div>

        {/* Export */}
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors flex-shrink-0"
          style={{ color: 'var(--tx-2)' }}
          title="Download .py file"
        >
          <Download size={13} />
          <span className="hidden sm:inline">Export</span>
        </button>

        {/* Divider */}
        <div className="w-px h-5 flex-shrink-0" style={{ background: 'var(--brd-med)' }} />

        {/* View mode segmented control */}
        <div
          className="flex p-0.5 rounded-lg flex-shrink-0"
          style={{ background: 'var(--surface)', border: '1px solid var(--brd)' }}
        >
          {VIEW_OPTIONS.map(({ mode, label, Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium transition-all duration-150"
              style={viewMode === mode
                ? { background: 'var(--surface2)', color: 'var(--tx)' }
                : { color: 'var(--tx-3)' }
              }
              title={label}
            >
              <Icon size={12} />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-5 flex-shrink-0" style={{ background: 'var(--brd-med)' }} />

        {/* Undo / Redo */}
        <div className="flex gap-0.5 flex-shrink-0">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            style={{ color: 'var(--tx-2)' }}
            title="Undo (⌘Z)"
          >
            <Undo2 size={13} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            style={{ color: 'var(--tx-2)' }}
            title="Redo (⌘⇧Z)"
          >
            <Redo2 size={13} />
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Run or Copy — depends on backend availability */}
        {backendAvailable ? (
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-all flex-shrink-0"
            title="Run script via local backend"
          >
            <Play size={11} />
            <span>{running ? 'Running…' : 'Run'}</span>
          </button>
        ) : (
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
              copied ? 'bg-emerald-600 text-white' : 'text-white'
            }`}
            style={copied ? {} : { background: 'var(--surface2)', color: 'var(--tx)' }}
            title="Copy generated code to clipboard"
          >
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        )}
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
        <div className="h-dvh flex flex-col overflow-hidden select-none" style={{ background: 'var(--base)', color: 'var(--tx)' }}>
          <header
            className="flex-shrink-0 h-14 flex items-center justify-between px-4 backdrop-blur-xl border-b"
            style={{ background: 'var(--elevated)', borderColor: 'var(--brd)' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', boxShadow: '0 2px 12px rgba(99,102,241,0.5)' }}
              >
                <Zap size={14} className="text-white" />
              </div>
              <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--tx)' }}>{fileName || 'Untitled'}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={undo} disabled={!canUndo}
                className="w-8 h-8 flex items-center justify-center rounded-xl disabled:opacity-25 active:bg-black/[0.06] dark:active:bg-white/10"
                style={{ color: 'var(--tx-2)' }}>
                <Undo2 size={15} />
              </button>
              <button onClick={redo} disabled={!canRedo}
                className="w-8 h-8 flex items-center justify-center rounded-xl disabled:opacity-25 active:bg-black/[0.06] dark:active:bg-white/10"
                style={{ color: 'var(--tx-2)' }}>
                <Redo2 size={15} />
              </button>
              {backendAvailable ? (
                <button onClick={handleRun} disabled={running}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 disabled:opacity-50 text-white">
                  {running ? 'Running…' : 'Run'}
                </button>
              ) : (
                <button onClick={handleCopy}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold text-white ${copied ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              )}
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
                background: 'var(--surface2)',
                border: '1px solid var(--brd-med)',
              }}
            >
              {MOBILE_TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setMobileTab(id)}
                  className="flex flex-col items-center gap-0.5 px-5 py-2 rounded-full transition-all duration-200"
                  style={mobileTab === id
                    ? { background: 'var(--elevated)', color: 'var(--tx)' }
                    : { color: 'var(--tx-3)' }
                  }
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
      <div className="h-screen flex flex-col overflow-hidden select-none" style={{ background: 'var(--base)', color: 'var(--tx)' }}>
        <DesktopHeader />

        <div className="flex flex-1 overflow-hidden">
          {/* Palette + Canvas — hidden in code-only mode */}
          {viewMode !== 'code' && (
            <>
              <div
                className="flex-shrink-0 overflow-hidden border-r"
                style={{ width: leftWidth, borderColor: 'var(--brd)' }}
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
                className="flex-shrink-0 overflow-hidden border-l"
                style={{ width: rightWidth, borderColor: 'var(--brd)' }}
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

        {/* Run result panel */}
        {runResult !== null && (
          <div className="flex-shrink-0 border-t max-h-48 overflow-y-auto" style={{ background: 'var(--elevated)', borderColor: 'var(--brd)' }}>
            <div className="flex items-center gap-2 px-3 py-1.5 border-b sticky top-0" style={{ background: 'var(--surface2)', borderColor: 'var(--brd)' }}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${runResult.returncode === 0 ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className="text-xs flex-1" style={{ color: 'var(--tx-2)' }}>
                {runResult.returncode === 0 ? 'Exited successfully' : `Exited with code ${runResult.returncode}`}
              </span>
              <button onClick={() => setRunResult(null)} className="ml-auto hover:text-red-400 transition-colors" style={{ color: 'var(--tx-4)' }}>
                <X size={14} />
              </button>
            </div>
            {runResult.stdout && (
              <pre className="px-3 py-2 text-xs text-emerald-600 dark:text-emerald-300 font-mono whitespace-pre-wrap leading-5">{runResult.stdout}</pre>
            )}
            {runResult.stderr && (
              <pre className="px-3 py-2 text-xs text-red-600 dark:text-red-300 font-mono whitespace-pre-wrap leading-5">{runResult.stderr}</pre>
            )}
            {!runResult.stdout && !runResult.stderr && (
              <p className="px-3 py-2 text-xs italic" style={{ color: 'var(--tx-3)' }}>No output</p>
            )}
          </div>
        )}
      </div>

      {dragOverlayContent}
    </DndContext>
  );
}
