import { useState, useRef, useEffect } from 'react';

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
    runtimeData: any;
}

export function Console({
    logs,
    isVisible,
    onClose,
    runtimeData,
}: ConsoleProps) {
    const [activeTab, setActiveTab] = useState<'logs' | 'runtime'>('logs');
    const [height, setHeight] = useState(384); // Default height h-96 = 24rem = 384px
    const isResizing = useRef(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;
            const newHeight = window.innerHeight - e.clientY;
            if (newHeight > 100 && newHeight < window.innerHeight - 100) {
                setHeight(newHeight);
            }
        };

        const handleMouseUp = () => {
            if (isResizing.current) {
                isResizing.current = false;
                document.body.style.cursor = '';
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        isResizing.current = true;
        document.body.style.cursor = 'row-resize';
        e.preventDefault();
    };

    if (!isVisible) return null;

    const hasRuntimeData = runtimeData && typeof runtimeData === 'object' && Object.keys(runtimeData).length > 0;

    return (
        <div
            style={{ height: `${height}px` }}
            className="relative bg-surface-900 border-t border-[var(--border-base)] flex flex-col font-mono text-[13px] animate-in slide-in-from-bottom duration-300"
        >
            <div
                className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize z-50 hover:bg-brand/50 transition-colors"
                onMouseDown={handleMouseDown}
            />
            <header className="flex items-center justify-between px-6 py-2 bg-[var(--border-muted)] border-b border-[var(--border-base)]">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`text-[10px] font-bold uppercase tracking-widest leading-none px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'logs'
                            ? 'bg-[var(--bg-app)] text-brand border border-[var(--border-base)]'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-base)]'
                            }`}
                    >
                        Debug Console
                    </button>
                    <button
                        onClick={() => setActiveTab('runtime')}
                        className={`text-[10px] font-bold uppercase tracking-widest leading-none px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'runtime'
                            ? 'bg-[var(--bg-app)] text-brand border border-[var(--border-base)]'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-base)]'
                            }`}
                    >
                        Runtime Data
                        {hasRuntimeData && (
                            <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-brand animate-pulse align-middle" />
                        )}
                    </button>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-base)] transition-all"
                    >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                )}
            </header>

            {activeTab === 'logs' ? (
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
            ) : (
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {!hasRuntimeData ? (
                        <div className="text-[var(--text-muted)] italic text-sm py-4">
                            {'>'} Runtime data is empty. Run the workflow to see live data here.
                        </div>
                    ) : (
                        <pre className="text-[var(--text-main)] text-xs leading-relaxed whitespace-pre-wrap break-all">
                            {JSON.stringify(runtimeData, null, 2)}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
}
