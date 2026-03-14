import React from 'react';
import { Icon } from '../icon';

interface AppParametersViewProps {
    title: string;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    placeholder?: React.ReactNode;
    className?: string;
}

export const AppParametersView: React.FC<AppParametersViewProps> = ({
    title,
    isExpanded,
    onToggle,
    children,
    placeholder,
    className = '',
}) => {
    return (
        <div className={`absolute top-0 right-0 w-full z-30 flex flex-col items-end transition-all duration-300 pr-[20px] pointer-events-none ${className}`}>
            <div
                className={`w-[350px] bg-[var(--bg-surface)] border-x border-b border-[var(--border-base)] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] rounded-bl-2xl rounded-br-none overflow-visible transition-all duration-300 flex flex-col pointer-events-auto ${isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
                style={{ maxHeight: isExpanded ? '85vh' : '0px' }}
            >
                <div className="p-4 flex flex-col max-h-[85vh] relative">
                    <div className="flex items-center justify-between mb-3 px-2">
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{title}</h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto px-2 pb-4 flex flex-col space-y-4 custom-scrollbar min-h-0">
                        {children || (
                            <div className="flex flex-col items-center justify-center py-4 text-center opacity-40">
                                <Icon name="settings" size={24} className="mb-2 text-[var(--text-muted)]" />
                                <p className="text-[10px] font-medium text-[var(--text-muted)]">
                                    {placeholder || 'No parameters available for this item'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Hide Notch (visible when expanded) */}
                    <button
                        onClick={onToggle}
                        className={`absolute bottom-0 right-[-1px] translate-y-full bg-[var(--bg-surface)] border border-t-0 border-[var(--border-base)] shadow-md rounded-b-xl px-6 py-1.5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors hover:bg-[var(--bg-app)] cursor-pointer z-30 ${isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    >
                        <span className="text-[10px] font-bold mr-1.5 uppercase tracking-wider">Hide</span>
                        <Icon name="up" size={14} />
                    </button>
                </div>
            </div>

            {/* Notch (visible when collapsed) */}
            <button
                onClick={onToggle}
                className={`bg-[var(--bg-surface)]/80 backdrop-blur-md border border-t-0 border-[var(--border-base)] shadow-md rounded-b-xl px-6 py-1.5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors hover:bg-[var(--bg-app)] cursor-pointer mt-[-1px] mr-[-1px] pointer-events-auto ${isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            >
                <span className="text-[10px] font-bold mr-1.5 uppercase tracking-wider">{title}</span>
                <Icon name="down" size={14} />
            </button>
        </div>
    );
};
