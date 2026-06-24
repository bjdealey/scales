import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuid } from 'uuid';
import { Block, BlockType, BLOCK_DEFAULTS, Variable, PythonType, TYPE_DEFAULTS, DictEntry, ListItem, PRIMITIVE_DEFAULTS, SortMode } from '../types';

interface BlockStore {
  blocks: Block[];
  variables: Variable[];
  variableSortMode: SortMode;
  setVariableSortMode: (mode: SortMode) => void;
  addBlock: (type: BlockType, parentId?: string, inElse?: boolean) => void;
  insertBlock: (type: BlockType, index: number, parentId?: string, inElse?: boolean) => void;
  removeBlock: (id: string) => void;
  updateBlock: (id: string, params: Record<string, string>) => void;
  moveBlock: (id: string, direction: 'up' | 'down') => void;
  clearAll: () => void;
  addVariable: () => void;
  addVariableWithName: (name: string, type: PythonType, initialValue?: string) => void;
  removeVariable: (id: string) => void;
  updateVariable: (id: string, patch: Partial<Omit<Variable, 'id'>>) => void;
  moveVariable: (id: string, direction: 'up' | 'down') => void;
  toggleLock: (id: string) => void;
  addListItem: (id: string) => void;
  updateListItem: (id: string, index: number, patch: Partial<ListItem>) => void;
  removeListItem: (id: string, index: number) => void;
  moveListItem: (id: string, index: number, direction: 'up' | 'down') => void;
  addDictEntry: (id: string) => void;
  updateDictEntry: (id: string, index: number, patch: Partial<DictEntry>) => void;
  removeDictEntry: (id: string, index: number) => void;
  moveDictEntry: (id: string, index: number, direction: 'up' | 'down') => void;
}

// Converts Python literal syntax to JSON so we can parse it:
// True/False/None → true/false/null, single quotes → double quotes.
function pyToJson(s: string): string {
  return s
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null')
    .replace(/'/g, '"');
}

function parseListItems(raw: string): ListItem[] {
  try {
    const parsed = JSON.parse(pyToJson(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item): ListItem => {
      if (typeof item === 'boolean') return { type: 'bool', value: item ? 'True' : 'False' };
      if (typeof item === 'number')
        return Number.isInteger(item)
          ? { type: 'int', value: String(item) }
          : { type: 'float', value: String(item) };
      if (typeof item === 'string') return { type: 'str', value: item };
      return { type: 'str', value: String(item) };
    });
  } catch {
    return [];
  }
}

function parseDictEntries(raw: string): DictEntry[] {
  try {
    const parsed = JSON.parse(pyToJson(raw));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return [];
    return Object.entries(parsed).map(([key, val]): DictEntry => {
      if (typeof val === 'boolean') return { key, valueType: 'bool', value: val ? 'True' : 'False' };
      if (typeof val === 'number')
        return Number.isInteger(val)
          ? { key, valueType: 'int', value: String(val) }
          : { key, valueType: 'float', value: String(val) };
      if (typeof val === 'string') return { key, valueType: 'str', value: val };
      return { key, valueType: 'str', value: String(val) };
    });
  } catch {
    return [];
  }
}

function clearVarRefs(blocks: Block[], name: string): void {
  for (const block of blocks) {
    for (const key of Object.keys(block.params)) {
      if (block.params[key] === name) block.params[key] = '';
    }
    clearVarRefs(block.children, name);
    clearVarRefs(block.elseChildren, name);
  }
}

function createBlock(type: BlockType): Block {
  return {
    id: uuid(),
    type,
    params: { ...BLOCK_DEFAULTS[type] },
    children: [],
    elseChildren: [],
  };
}

function findAndAdd(
  blocks: Block[],
  parentId: string,
  newBlock: Block,
  inElse: boolean,
): boolean {
  for (const block of blocks) {
    if (block.id === parentId) {
      if (inElse) {
        block.elseChildren.push(newBlock);
      } else {
        block.children.push(newBlock);
      }
      return true;
    }
    if (findAndAdd(block.children, parentId, newBlock, inElse)) return true;
    if (findAndAdd(block.elseChildren, parentId, newBlock, inElse)) return true;
  }
  return false;
}

function findAndInsert(
  blocks: Block[],
  parentId: string,
  newBlock: Block,
  index: number,
  inElse: boolean,
): boolean {
  for (const block of blocks) {
    if (block.id === parentId) {
      const arr = inElse ? block.elseChildren : block.children;
      arr.splice(index, 0, newBlock);
      return true;
    }
    if (findAndInsert(block.children, parentId, newBlock, index, inElse)) return true;
    if (findAndInsert(block.elseChildren, parentId, newBlock, index, inElse)) return true;
  }
  return false;
}

function findAndRemove(blocks: Block[], id: string): boolean {
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].id === id) {
      blocks.splice(i, 1);
      return true;
    }
    if (findAndRemove(blocks[i].children, id)) return true;
    if (findAndRemove(blocks[i].elseChildren, id)) return true;
  }
  return false;
}

function findAndUpdate(
  blocks: Block[],
  id: string,
  params: Record<string, string>,
): boolean {
  for (const block of blocks) {
    if (block.id === id) {
      block.params = { ...block.params, ...params };
      return true;
    }
    if (findAndUpdate(block.children, id, params)) return true;
    if (findAndUpdate(block.elseChildren, id, params)) return true;
  }
  return false;
}

function findAndMove(blocks: Block[], id: string, direction: 'up' | 'down'): boolean {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx !== -1) {
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx >= 0 && swapIdx < blocks.length) {
      [blocks[idx], blocks[swapIdx]] = [blocks[swapIdx], blocks[idx]];
    }
    return true;
  }
  for (const block of blocks) {
    if (findAndMove(block.children, id, direction)) return true;
    if (findAndMove(block.elseChildren, id, direction)) return true;
  }
  return false;
}

export const useBlockStore = create<BlockStore>()(
  immer((set) => ({
    blocks: [],
    variables: [],
    variableSortMode: 'custom',

    setVariableSortMode: (mode) => {
      set((state) => { state.variableSortMode = mode; });
    },

    addBlock: (type, parentId, inElse = false) => {
      set((state) => {
        const newBlock = createBlock(type);
        if (!parentId) {
          state.blocks.push(newBlock);
        } else {
          findAndAdd(state.blocks, parentId, newBlock, inElse);
        }
      });
    },

    insertBlock: (type, index, parentId, inElse = false) => {
      set((state) => {
        const newBlock = createBlock(type);
        if (!parentId) {
          state.blocks.splice(index, 0, newBlock);
        } else {
          findAndInsert(state.blocks, parentId, newBlock, index, inElse);
        }
      });
    },

    removeBlock: (id) => {
      set((state) => {
        findAndRemove(state.blocks, id);
      });
    },

    updateBlock: (id, params) => {
      set((state) => {
        findAndUpdate(state.blocks, id, params);
      });
    },

    moveBlock: (id, direction) => {
      set((state) => {
        findAndMove(state.blocks, id, direction);
      });
    },

    clearAll: () => {
      set((state) => {
        state.blocks = [];
      });
    },

    addVariable: () => {
      set((state) => {
        state.variables.push({
          id: uuid(),
          name: '',
          type: 'str',
          value: '',
          items: [],
          entries: [],
          locked: false,
          constant: false,
        });
      });
    },

    addVariableWithName: (name: string, type: PythonType, initialValue?: string) => {
      set((state) => {
        const raw = initialValue ?? TYPE_DEFAULTS[type];
        // Normalize bool casing; parse structured types into their item/entry arrays.
        const value   = type === 'bool' ? (/^false$/i.test(raw) ? 'False' : 'True') : (type === 'list' || type === 'dict' ? '' : raw);
        const items   = type === 'list' && initialValue ? parseListItems(initialValue) : [];
        const entries = type === 'dict' && initialValue ? parseDictEntries(initialValue) : [];
        state.variables.push({
          id: uuid(),
          name,
          type,
          value,
          items,
          entries,
          locked: false,
          constant: false,
        });
      });
    },

    removeVariable: (id) => {
      set((state) => {
        const idx = state.variables.findIndex((v) => v.id === id);
        if (idx === -1) return;
        const name = state.variables[idx].name.trim();
        state.variables.splice(idx, 1);
        if (name) clearVarRefs(state.blocks, name);
      });
    },

    updateVariable: (id, patch) => {
      set((state) => {
        const v = state.variables.find((v) => v.id === id);
        if (!v) return;
        if (patch.type && patch.type !== v.type) {
          v.value = TYPE_DEFAULTS[patch.type];
          v.items = [];
          v.entries = [];
        }
        Object.assign(v, patch);
      });
    },

    toggleLock: (id) => {
      set((state) => {
        const v = state.variables.find((v) => v.id === id);
        if (v) v.locked = !v.locked;
      });
    },

    addListItem: (id) => {
      set((state) => {
        const v = state.variables.find((v) => v.id === id);
        if (v) v.items.push({ type: 'str', value: '' });
      });
    },

    updateListItem: (id, index, patch) => {
      set((state) => {
        const v = state.variables.find((v) => v.id === id);
        if (!v) return;
        if (patch.type && patch.type !== v.items[index].type) {
          v.items[index].value = PRIMITIVE_DEFAULTS[patch.type];
        }
        Object.assign(v.items[index], patch);
      });
    },

    removeListItem: (id, index) => {
      set((state) => {
        const v = state.variables.find((v) => v.id === id);
        if (v) v.items.splice(index, 1);
      });
    },

    moveListItem: (id, index, direction) => {
      set((state) => {
        const v = state.variables.find((v) => v.id === id);
        if (!v) return;
        const swap = direction === 'up' ? index - 1 : index + 1;
        if (swap >= 0 && swap < v.items.length)
          [v.items[index], v.items[swap]] = [v.items[swap], v.items[index]];
      });
    },

    addDictEntry: (id) => {
      set((state) => {
        const v = state.variables.find((v) => v.id === id);
        if (v) v.entries.push({ key: '', valueType: 'str', value: '' });
      });
    },

    updateDictEntry: (id, index, patch) => {
      set((state) => {
        const v = state.variables.find((v) => v.id === id);
        if (!v) return;
        if (patch.valueType && patch.valueType !== v.entries[index].valueType) {
          v.entries[index].value = PRIMITIVE_DEFAULTS[patch.valueType];
        }
        Object.assign(v.entries[index], patch);
      });
    },

    removeDictEntry: (id, index) => {
      set((state) => {
        const v = state.variables.find((v) => v.id === id);
        if (v) v.entries.splice(index, 1);
      });
    },

    moveDictEntry: (id, index, direction) => {
      set((state) => {
        const v = state.variables.find((v) => v.id === id);
        if (!v) return;
        const swap = direction === 'up' ? index - 1 : index + 1;
        if (swap >= 0 && swap < v.entries.length)
          [v.entries[index], v.entries[swap]] = [v.entries[swap], v.entries[index]];
      });
    },

    moveVariable: (id, direction) => {
      set((state) => {
        const idx = state.variables.findIndex((v) => v.id === id);
        if (idx === -1) return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx >= 0 && swapIdx < state.variables.length) {
          const temp = state.variables[idx];
          state.variables[idx] = state.variables[swapIdx];
          state.variables[swapIdx] = temp;
        }
      });
    },
  })),
);
