import { createContext, useContext } from 'react';

export const LineMapContext = createContext<Record<string, number>>({});
export const useLineMap = () => useContext(LineMapContext);
