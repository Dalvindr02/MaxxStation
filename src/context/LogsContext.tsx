import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export type LogStatus = 'approved' | 'rejected' | 'review';

export type LogEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  projectId: string;
  projectName: string;
  taskId: string | null;
  taskName: string | null;
  startTime: string;
  endTime: string;
  category: string;
  notes: string;
  billable: boolean;
  status: LogStatus;
};

type LogsContextValue = {
  logs: LogEntry[];
  editingLog: LogEntry | null;
  addLog: (entry: Omit<LogEntry, 'id' | 'status'> & { status?: LogStatus }) => void;
  updateLog: (id: string, updates: Partial<Omit<LogEntry, 'id'>>) => void;
  deleteLog: (id: string) => void;
  startEditing: (log: LogEntry) => void;
  clearEditing: () => void;
};

const INITIAL_LOGS: LogEntry[] = [];

const LogsContext = createContext<LogsContextValue | null>(null);

export const LogsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [editingLog, setEditingLog] = useState<LogEntry | null>(null);

  const addLog: LogsContextValue['addLog'] = useCallback(entry => {
    setLogs(prev => [
      {
        id: Date.now().toString(),
        status: entry.status ?? 'review',
        ...entry,
      },
      ...prev,
    ]);
  }, []);

  const updateLog: LogsContextValue['updateLog'] = useCallback((id, updates) => {
    setLogs(prev =>
      prev.map(log => (log.id === id ? { ...log, ...updates } : log)),
    );
  }, []);

  const deleteLog: LogsContextValue['deleteLog'] = useCallback(id => {
    setLogs(prev => prev.filter(log => log.id !== id));
  }, []);

  const startEditing: LogsContextValue['startEditing'] = useCallback(log => {
    setEditingLog(log);
  }, []);

  const clearEditing = useCallback(() => setEditingLog(null), []);

  const value = useMemo(
    () => ({
      logs,
      editingLog,
      addLog,
      updateLog,
      deleteLog,
      startEditing,
      clearEditing,
    }),
    [
      addLog,
      clearEditing,
      deleteLog,
      editingLog,
      logs,
      startEditing,
      updateLog,
    ],
  );

  return <LogsContext.Provider value={value}>{children}</LogsContext.Provider>;
};

export const useLogs = () => {
  const context = useContext(LogsContext);
  if (!context) {
    throw new Error('useLogs must be used within LogsProvider');
  }
  return context;
};
