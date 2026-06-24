import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Palette } from 'lucide-react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { useBlockStore } from '../store/blockStore';
import { generatePython } from '../codegen/generator';
import { TYPE_LABELS } from '../types';

interface ThemeOption {
  id: string;
  label: string;
  group: string;
  file?: string;
}

const THEMES: ThemeOption[] = [
  { id: 'vs-dark',        label: 'VS Code Dark',  group: 'VS Code' },
  { id: 'vs',             label: 'VS Code Light', group: 'VS Code' },
  { id: 'dracula',        label: 'Dracula',        group: 'Popular', file: '/themes/Dracula.json' },
  { id: 'monokai',        label: 'Monokai',        group: 'Popular', file: '/themes/Monokai.json' },
  { id: 'night-owl',      label: 'Night Owl',      group: 'Popular', file: '/themes/Night Owl.json' },
  { id: 'nord',           label: 'Nord',           group: 'Popular', file: '/themes/Nord.json' },
  { id: 'tomorrow-night', label: 'Tomorrow Night', group: 'Popular', file: '/themes/Tomorrow-Night.json' },
  { id: 'github-dark',    label: 'GitHub Dark',    group: 'GitHub',  file: '/themes/GitHub Dark.json' },
  { id: 'solarized-dark', label: 'Solarized Dark', group: 'Classic', file: '/themes/Solarized-dark.json' },
];

const GROUPS = [...new Set(THEMES.map((t) => t.group))];

export default function CodePreview() {
  const blocks    = useBlockStore((s) => s.blocks);
  const variables = useBlockStore((s) => s.variables);
  const sortMode  = useBlockStore((s) => s.variableSortMode);
  const monaco    = useMonaco();

  const sortedVars = useMemo(() => {
    if (sortMode === 'custom') return variables;
    const copy = [...variables];
    if (sortMode === 'name-asc')  copy.sort((a, b) => a.name.localeCompare(b.name));
    if (sortMode === 'name-desc') copy.sort((a, b) => b.name.localeCompare(a.name));
    if (sortMode === 'type')      copy.sort((a, b) => TYPE_LABELS[a.type].localeCompare(TYPE_LABELS[b.type]));
    return copy;
  }, [variables, sortMode]);

  const code = generatePython(blocks, sortedVars);

  const [copied, setCopied]           = useState(false);
  const [editorTheme, setEditorTheme] = useState('vs-dark');

  useEffect(() => {
    if (!monaco) return;
    THEMES.filter((t) => t.file).forEach(({ id, file }) => {
      fetch(file!)
        .then((r) => r.json())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((data) => monaco.editor.defineTheme(id, data as any))
        .catch(() => {});
    });
  }, [monaco]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <aside className="w-full h-full flex flex-col overflow-hidden" style={{ background: 'var(--elevated)' }}>
      <div className="px-3 py-1.5 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: 'var(--brd)' }}>
        <div className="flex items-center gap-1.5">
          <Palette size={12} className="flex-shrink-0" style={{ color: 'var(--tx-3)' }} />
          <select
            value={editorTheme}
            onChange={(e) => setEditorTheme(e.target.value)}
            className="sk-select rounded text-xs px-1.5 py-1"
          >
            {GROUPS.map((group) => (
              <optgroup key={group} label={group}>
                {THEMES.filter((t) => t.group === group).map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors"
          style={{ color: 'var(--tx-2)' }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language="python"
          value={code}
          theme={editorTheme}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            renderLineHighlight: 'none',
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>
    </aside>
  );
}
