interface LogEntry {
    timestamp: string;
    message: string;
    node_id?: string;
    level: string;
}

interface ConsoleProps {
    logs: LogEntry[];
    isVisible: boolean;
    onClose?: () => void;
}

export function Console({ logs, isVisible, onClose }: ConsoleProps) {
    if (!isVisible) return null;

    return (
        <div className="h-64 bg-surface-900 border-t border-[var(--border-base)] flex flex-col font-mono text-[13px] animate-in slide-in-from-bottom duration-300">
            <header className="flex items-center justify-between px-6 py-2 bg-[var(--border-muted)] border-b border-[var(--border-base)]">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest leading-none">Debug Console</span>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-base)] transition-all"
                    >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="12"></line>
                        </svg>
                    </button>
                )}
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                {logs.length === 0 ? (
                    <div className="text-[var(--text-muted)] italic text-sm py-4">
                        {'>'} Waiting for workflow execution logs...
                    </div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className="flex gap-4 group hover:bg-[var(--border-muted)] -mx-4 px-4 py-0.5 transition-colors">
                            <span className="text-[var(--text-muted)] shrink-0 select-none opacity-60">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                            </span>
                            <div className="flex-1 flex gap-2 min-w-0">
                                {log.node_id && (
                                    <span className="text-brand font-bold shrink-0 opacity-80">{log.node_id}:</span>
                                )}
                                <span className={`
                                    break-all
                                    ${log.level === 'error' ? 'text-red-500' : ''}
                                    ${log.level === 'critical' ? 'bg-red-500/10 text-red-500 px-1 rounded' : ''}
                                    ${log.level === 'info' ? 'text-[var(--text-main)]' : ''}
                                    ${log.level === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : ''}
                                    ${!['error', 'critical', 'info', 'warning'].includes(log.level) ? 'text-[var(--text-muted)]' : ''}
                                `}>
                                    {log.message}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}


