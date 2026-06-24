import { useCallback, useEffect, useRef, useState } from 'react';
import { FileCode2, Layers, LayoutDashboard, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import BlockPalette from './components/BlockPalette';
import Canvas from './components/Canvas';
import CodePreview from './components/CodePreview';

const LEFT_MIN = 200;
const LEFT_MAX = 560;
const RIGHT_MIN = 300;
const RIGHT_MAX = 700;
const LEFT_DEFAULT = 240;
const RIGHT_DEFAULT = 480;

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

export default function App() {
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<MobileTab>('canvas');

  const [leftWidth, setLeftWidth]   = useState(LEFT_DEFAULT);
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT);
  const [leftVisible, setLeftVisible]   = useState(true);
  const [rightVisible, setRightVisible] = useState(true);

  const leftWidthRef  = useRef(leftWidth);
  const rightWidthRef = useRef(rightWidth);
  leftWidthRef.current  = leftWidth;
  rightWidthRef.current = rightWidth;

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

  /* ── Mobile layout ── */
  if (isMobile) {
    return (
      <div className="h-dvh flex flex-col bg-gray-950 text-white overflow-hidden select-none">
        <header className="h-11 bg-gray-900 border-b border-gray-700 flex items-center justify-center gap-2 flex-shrink-0">
          <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center flex-shrink-0">
            <Zap size={12} className="text-white" />
          </div>
          <h1 className="font-bold text-sm text-white">Scales</h1>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col">
          {mobileTab === 'palette' && <BlockPalette />}
          {mobileTab === 'canvas'  && <Canvas />}
          {mobileTab === 'code'    && <CodePreview />}
        </div>

        <nav
          className="flex-shrink-0 bg-gray-900 border-t border-gray-700 flex"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {MOBILE_TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setMobileTab(id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                mobileTab === id ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon size={20} />
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </nav>
      </div>
    );
  }

  /* ── Desktop layout ── */
  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden select-none">
      <header className="h-11 bg-gray-900 border-b border-gray-700 flex items-center px-3 gap-2 flex-shrink-0">
        <button
          onClick={() => setLeftVisible((v) => !v)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
            leftVisible
              ? 'text-gray-400 hover:text-white hover:bg-gray-700'
              : 'text-blue-400 hover:text-blue-300 hover:bg-gray-700'
          }`}
          title={leftVisible ? 'Hide sidebar' : 'Show sidebar'}
        >
          {leftVisible ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          <span className="hidden sm:inline">{leftVisible ? 'Hide' : 'Sidebar'}</span>
        </button>

        <div className="flex items-center gap-2 flex-1 justify-center">
          <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center flex-shrink-0">
            <Zap size={12} className="text-white" />
          </div>
          <h1 className="font-bold text-sm text-white">Scales</h1>
        </div>

        <button
          onClick={() => setRightVisible((v) => !v)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
            rightVisible
              ? 'text-gray-400 hover:text-white hover:bg-gray-700'
              : 'text-blue-400 hover:text-blue-300 hover:bg-gray-700'
          }`}
          title={rightVisible ? 'Hide code panel' : 'Show code panel'}
        >
          <span className="hidden sm:inline">Code</span>
          {rightVisible ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {leftVisible && (
          <>
            <div
              className="flex-shrink-0 border-r border-gray-700 overflow-hidden"
              style={{ width: leftWidth }}
            >
              <BlockPalette />
            </div>
            <ResizeHandle onMouseDown={startLeftResize} />
          </>
        )}

        <Canvas />

        {rightVisible && (
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
      </div>
    </div>
  );
}
