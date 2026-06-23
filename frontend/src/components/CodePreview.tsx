import { useMemo, useState } from 'react';
import { Check, Copy, Play, X } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useBlockStore } from '../store/blockStore';
import { generatePython } from '../codegen/generator';
import { TYPE_LABELS } from '../types';

interface RunResult {
  stdout: string;
  stderr: string;
  returncode: number;
}

export default function CodePreview() {
  const blocks = useBlockStore((s) => s.blocks);
  const variables = useBlockStore((s) => s.variables);
  const sortMode = useBlockStore((s) => s.variableSortMode);

  const sortedVars = useMemo(() => {
    if (sortMode === 'custom') return variables;
    const copy = [...variables];
    if (sortMode === 'name-asc')  copy.sort((a, b) => a.name.localeCompare(b.name));
    if (sortMode === 'name-desc') copy.sort((a, b) => b.name.localeCompare(a.name));
    if (sortMode === 'type')      copy.sort((a, b) => TYPE_LABELS[a.type].localeCompare(TYPE_LABELS[b.type]));
    return copy;
  }, [variables, sortMode]);

  const code = generatePython(blocks, sortedVars);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [copied, setCopied] = useState(false);

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
          <p className="text-xs text-gray-600">Assembles as you add scales</p>
        </div>
        <div className="flex items-center gap-2">
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
            theme="vs-dark"
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
              <span
                className={`w-2 h-2 rounded-full ${result.returncode === 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
              />
              <span className="text-xs text-gray-400">
                {result.returncode === 0 ? 'Exited successfully' : `Exited with code ${result.returncode}`}
              </span>
              <button
                onClick={() => setResult(null)}
                className="ml-auto text-gray-600 hover:text-gray-400"
              >
                <X size={14} />
              </button>
            </div>
            {result.stdout && (
              <pre className="px-3 py-2 text-xs text-emerald-300 font-mono whitespace-pre-wrap leading-5">
                {result.stdout}
              </pre>
            )}
            {result.stderr && (
              <pre className="px-3 py-2 text-xs text-red-300 font-mono whitespace-pre-wrap leading-5">
                {result.stderr}
              </pre>
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
