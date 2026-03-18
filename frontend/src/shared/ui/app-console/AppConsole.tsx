import React, { useRef, useEffect, useState } from 'react';
import { AppTabs } from '../app-tabs/AppTabs';
import type { AppTab } from '../app-tabs/AppTabs';
import { Icon } from '../icon';

export interface ConsoleLog {
    timestamp: string;
    message: string;
    level: string; // 'info' | 'error' | 'warning' | 'critical' | 'system' | etc.
}

interface AppConsoleProps {
    tabs: AppTab[];
    activeTab: string;
    onTabChange: (id: string) => void;
    height?: number;
    onHeightChange?: (height: number) => void;
    isVisible?: boolean;
    onClose?: () => void;
    headerActions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    resizable?: boolean;
}

export const AppConsole: React.FC<AppConsoleProps> = ({
    tabs,
    activeTab,
    onTabChange,
    height,
    onHeightChange,
    isVisible = true,
    onClose,
    headerActions,
    children,
    className = '',
    resizable = false,
}) => {
    const isResizing = useRef(false);

    useEffect(() => {
        if (!resizable || !onHeightChange) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;
            const newHeight = window.innerHeight - e.clientY;
            if (newHeight > 100 && newHeight < window.innerHeight - 100) {
                onHeightChange(newHeight);
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
    }, [resizable, onHeightChange]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!resizable) return;
        isResizing.current = true;
        document.body.style.cursor = 'row-resize';
        e.preventDefault();
    };

    if (!isVisible) return null;

    return (
        <div
            style={height ? { height: `${height}px` } : undefined}
            className={`relative flex flex-col bg-[var(--bg-app)] border border-[var(--border-base)] rounded-xl overflow-hidden shadow-inner ${className}`}
        >
            {resizable && (
                <div
                    className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize z-50 hover:bg-brand/50 transition-colors"
                    onMouseDown={handleMouseDown}
                />
            )}
            <header className="flex items-center justify-between px-2 bg-[var(--bg-header)] border-b border-[var(--border-base)] min-h-[40px]">
                <div className="flex items-center">
                    <AppTabs
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={onTabChange}
                        className="h-10"
                    />
                </div>
                <div className="flex items-center gap-3 px-2">
                    {headerActions}
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
                </div>
            </header>

            <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
                {children}
            </div>
        </div>
    );
};

interface AppConsoleLogLineProps {
    log: ConsoleLog;
}

export const AppConsoleLogLine: React.FC<AppConsoleLogLineProps> = ({ log }) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(log.message);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 500);
    };

    return (
        <div className="flex gap-4 px-2 py-0.5 -mx-2 relative font-mono text-[13px] group/line">
            <span className="text-[var(--text-muted)] shrink-0 select-none opacity-60 pl-1 w-[65px] pt-1">
                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
            </span>
            
            <div className="flex-1 min-w-0 relative group/msg">
                <button
                    onClick={handleCopy}
                    title="Copy message"
                    style={{ left: '30px', top: '20px' }}
                    className={`absolute bg-[var(--bg-app)] border transition-all duration-300 shadow-xl z-30 flex items-center justify-center overflow-hidden
                        ${isCopied 
                            ? 'px-3 py-1.5 rounded-xl text-brand border-brand opacity-100 translate-y-0 w-[80px] h-[32px]' 
                            : 'w-9 h-9 rounded-full text-[var(--text-muted)] border-[var(--border-base)] opacity-0 group-hover/msg:opacity-100 translate-y-1 group-hover/msg:translate-y-0 hover:text-brand hover:border-brand shadow-lg'
                        }`}
                >
                    <div className="relative w-full h-full flex items-center justify-center">
                        <span className={`absolute transition-all duration-300 text-[10px] font-black uppercase tracking-widest whitespace-nowrap
                            ${isCopied ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none translate-x-1'}`}>
                            Copied
                        </span>
                        <div className={`transition-all duration-300 ${isCopied ? 'opacity-0 scale-75' : 'opacity-100 scale-100'}`}>
                            <Icon name="content_copy" size={15} />
                        </div>
                    </div>
                </button>

                <div className="w-fit max-w-full border border-transparent group-hover/msg:border-brand/20 group-hover/msg:bg-brand/10 rounded-lg transition-all px-2 py-1 -mx-2">
                    <span className={`
                        break-all block
                        ${log.level === 'error' ? 'text-red-500 font-medium' : ''}
                        ${log.level === 'critical' ? 'bg-red-500/10 text-red-500 px-1 rounded font-medium' : ''}
                        ${log.level === 'info' ? 'text-[var(--text-main)] font-medium' : ''}
                        ${log.level === 'warning' ? 'text-yellow-600 dark:text-yellow-400 font-medium' : ''}
                        ${!['error', 'critical', 'info', 'warning'].includes(log.level) ? 'text-[var(--text-muted)] opacity-50' : ''}
                    `}>
                        {log.message}
                    </span>
                </div>
            </div>
        </div>
    );
};
