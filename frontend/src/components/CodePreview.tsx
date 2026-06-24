import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Palette, Play, X } from 'lucide-react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { useBlockStore } from '../store/blockStore';
import { generatePython } from '../codegen/generator';
import { TYPE_LABELS } from '../types';

interface RunResult {
  stdout: string;
  stderr: string;
  returncode: number;
}

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

  const [running, setRunning]         = useState(false);
  const [result, setResult]           = useState<RunResult | null>(null);
  const [copied, setCopied]           = useState(false);
  const [editorTheme, setEditorTheme] = useState('vs-dark');

  // Load and register all custom themes once Monaco is ready
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

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data: RunResult = await res.json();
      setResult(data);
    } catch {
      setResult({ stdout: '', stderr: 'Failed to connect to backend. Is it running?', returncode: 1 });
    } finally {
      setRunning(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <aside className="w-full h-full bg-gray-900 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Your Python Script</p>
          <p className="text-xs text-gray-600">Assembles as you add actions</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Palette size={12} className="text-gray-500 flex-shrink-0" />
            <select
              value={editorTheme}
              onChange={(e) => setEditorTheme(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded text-xs text-gray-400 px-1.5 py-1 focus:outline-none focus:border-blue-400 cursor-pointer"
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
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleRun}
            disabled={running || (blocks.length === 0 && variables.filter((v) => v.name.trim()).length === 0)}
            className="flex items-center gap-1.5 text-xs text-white px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            <Play size={12} />
            {running ? 'Running…' : 'Run'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
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

        {result !== null && (
          <div className="flex-shrink-0 border-t border-gray-700 max-h-48 overflow-y-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border-b border-gray-700">
              <span className={`w-2 h-2 rounded-full ${result.returncode === 0 ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className="text-xs text-gray-400">
                {result.returncode === 0 ? 'Exited successfully' : `Exited with code ${result.returncode}`}
              </span>
              <button onClick={() => setResult(null)} className="ml-auto text-gray-600 hover:text-gray-400">
                <X size={14} />
              </button>
            </div>
            {result.stdout && (
              <pre className="px-3 py-2 text-xs text-emerald-300 font-mono whitespace-pre-wrap leading-5">{result.stdout}</pre>
            )}
            {result.stderr && (
              <pre className="px-3 py-2 text-xs text-red-300 font-mono whitespace-pre-wrap leading-5">{result.stderr}</pre>
            )}
            {!result.stdout && !result.stderr && (
              <p className="px-3 py-2 text-xs text-gray-500 italic">No output</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
