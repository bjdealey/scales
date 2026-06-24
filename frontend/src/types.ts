export type PythonType = 'str' | 'int' | 'float' | 'bool' | 'list' | 'dict' | 'None' | 'Any';

export type SortMode = 'custom' | 'name-asc' | 'name-desc' | 'type';

export const PYTHON_TYPES: PythonType[] = ['str', 'int', 'float', 'bool', 'list', 'dict', 'None', 'Any'];

export const TYPE_LABELS: Record<PythonType, string> = {
  str: 'String',
  int: 'Integer',
  float: 'Float',
  bool: 'Boolean',
  list: 'List',
  dict: 'Dictionary',
  None: 'None',
  Any: 'Any',
};

export const TYPE_DEFAULTS: Record<PythonType, string> = {
  str: '',
  int: '0',
  float: '0.0',
  bool: 'True',
  list: '',
  dict: '',
  None: 'None',
  Any: '',
};

export const TYPE_PLACEHOLDERS: Record<PythonType, string> = {
  str: 'Enter text...',
  int: '0',
  float: '0.0',
  bool: 'True',
  list: '',
  dict: '',
  None: '',
  Any: "e.g. os.environ.get('API_KEY')",
};

export type PrimitiveType = 'str' | 'int' | 'float' | 'bool';

export const PRIMITIVE_TYPES: PrimitiveType[] = ['str', 'int', 'float', 'bool'];

export const PRIMITIVE_LABELS: Record<PrimitiveType, string> = {
  str: 'String',
  int: 'Integer',
  float: 'Float',
  bool: 'Boolean',
};

export const PRIMITIVE_SHORT: Record<PrimitiveType, string> = {
  str: 'Str',
  int: 'Int',
  float: 'Float',
  bool: 'Bool',
};

export const PRIMITIVE_DEFAULTS: Record<PrimitiveType, string> = {
  str: '',
  int: '0',
  float: '0.0',
  bool: 'True',
};

export interface ListItem {
  type: PrimitiveType;
  value: string;
}

export interface DictEntry {
  key: string;
  valueType: PrimitiveType;
  value: string;
}

export interface Variable {
  id: string;
  name: string;
  type: PythonType;
  value: string;        // str, int, float, bool, any
  items: ListItem[];    // list
  entries: DictEntry[]; // dict
  locked: boolean;
  constant: boolean;
}

export type BlockType =
  | 'http_request'
  | 'set_variable'
  | 'for_each'
  | 'if_condition'
  | 'print'
  | 'file_write';

export interface Block {
  id: string;
  type: BlockType;
  params: Record<string, string>;
  children: Block[];
  elseChildren: Block[];
}

export const BLOCK_META: Record<
  BlockType,
  { label: string; color: string; borderColor: string; isContainer: boolean }
> = {
  http_request: {
    label: 'HTTP Request',
    color: 'bg-blue-600',
    borderColor: 'border-blue-500',
    isContainer: false,
  },
  set_variable: {
    label: 'Set Variable',
    color: 'bg-emerald-600',
    borderColor: 'border-emerald-500',
    isContainer: false,
  },
  for_each: {
    label: 'For Each',
    color: 'bg-violet-600',
    borderColor: 'border-violet-500',
    isContainer: true,
  },
  if_condition: {
    label: 'If Condition',
    color: 'bg-amber-600',
    borderColor: 'border-amber-500',
    isContainer: true,
  },
  print: {
    label: 'Print',
    color: 'bg-slate-600',
    borderColor: 'border-slate-500',
    isContainer: false,
  },
  file_write: {
    label: 'File Write',
    color: 'bg-rose-600',
    borderColor: 'border-rose-500',
    isContainer: false,
  },
};

export const BLOCK_DEFAULTS: Record<BlockType, Record<string, string>> = {
  http_request: { method: 'GET', url: '', varName: 'response', params: '', headers: '', json: '', data: '', files: '', cookies: '', auth: '' },
  set_variable: { name: '', value: '' },
  for_each: { itemVar: 'item', iterable: '' },
  if_condition: { condition: '' },
  print: { expression: '' },
  file_write: { path: '', content: '' },
};
