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
        <div className={`absolute top-0 right-0 w-full z-30 flex flex-col items-end pr-[20px] pointer-events-none ${className}`}>
            <div
                className={`w-[350px] transition-transform duration-150 ease-in-out flex flex-col pointer-events-auto`}
                style={{ 
                    transform: isExpanded ? 'translateY(0)' : 'translateY(calc(-100% + 26px))' 
                }}
            >
                {/* Main Glass Panel */}
                <div className="relative bg-surface-700/05 backdrop-blur-2xl border-x border-b border-[var(--border-base)] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] rounded-bl-2xl rounded-br-none overflow-hidden flex flex-col">
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
                    </div>
                </div>

                {/* Unified Notch Button */}
                <div className="flex justify-end pr-0">
                    <button
                        onClick={onToggle}
                        className="bg-surface-700/05 backdrop-blur-2xl border border-t-0 border-[var(--border-base)] shadow-[0_8px_16px_-6px_rgba(0,0,0,0.1)] rounded-b-xl px-6 py-1.5 flex items-center justify-center text-[var(--text-muted)] hover:text-brand transition-all hover:bg-brand/10 cursor-pointer pointer-events-auto group"
                    >
                        <span className="text-[10px] font-bold mr-1.5 uppercase tracking-wider transition-colors">
                            {isExpanded ? 'Hide' : title}
                        </span>
                        <Icon name={isExpanded ? "up" : "down"} size={14} className="transition-transform duration-300" />
                    </button>
                </div>
            </div>
        </div>
    );
};
