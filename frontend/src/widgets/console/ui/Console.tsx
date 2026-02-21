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
        <div className="h-64 bg-surface-900 border-t border-white/5 flex flex-col font-mono text-[13px] animate-in slide-in-from-bottom duration-300">
            <header className="flex items-center justify-between px-6 py-2 bg-white/[0.02] border-b border-white/5">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none">Debug Console</span>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 rounded-md text-white/20 hover:text-white hover:bg-white/5 transition-all"
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
                    <div className="text-white/20 italic text-sm py-4">
                        {'>'} Waiting for workflow execution logs...
                    </div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className="flex gap-4 group hover:bg-white/[0.02] -mx-4 px-4 py-0.5 transition-colors">
                            <span className="text-white/20 shrink-0 select-none">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                            </span>
                            <div className="flex-1 flex gap-2 min-w-0">
                                {log.node_id && (
                                    <span className="text-brand/60 font-bold shrink-0">{log.node_id}:</span>
                                )}
                                <span className={`
                                    break-all
                                    ${log.level === 'error' ? 'text-red-400' : ''}
                                    ${log.level === 'critical' ? 'bg-red-500/20 text-red-400 px-1 rounded' : ''}
                                    ${log.level === 'info' ? 'text-white/80' : ''}
                                    ${log.level === 'warning' ? 'text-yellow-400/80' : ''}
                                    ${!['error', 'critical', 'info', 'warning'].includes(log.level) ? 'text-white/60' : ''}
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

