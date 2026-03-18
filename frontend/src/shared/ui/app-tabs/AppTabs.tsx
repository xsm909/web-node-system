import React from 'react';

import { Icon } from '../icon';

export interface AppTab {
    id: string;
    label: string;
    icon?: string;
}

export interface AppTabsProps {
    tabs: AppTab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
    className?: string;
    variant?: 'boxed' | 'underline';
}

/**
 * Standardized Tab component for the platform.
 * Supports two variants:
 * - 'boxed': Rounded top corners with subtle background (default for forms)
 * - 'underline': Simple text with a bottom border (default for top-level navigation)
 */
export const AppTabs: React.FC<AppTabsProps> = ({
    tabs,
    activeTab,
    onTabChange,
    className = '',
    variant = 'boxed'
}) => {
    return (
        <div className={`flex gap-2 ${className}`}>
            {tabs.map(tab => {
                const isActive = activeTab === tab.id;
                
                if (variant === 'underline') {
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onTabChange(tab.id)}
                            className={`px-6 py-5 text-sm font-bold transition-all relative flex items-center gap-2.5 ${
                                isActive ? 'text-brand' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] opacity-60 hover:opacity-100'
                            }`}
                        >
                            {tab.icon && <Icon name={tab.icon} size={16} className={isActive ? 'text-brand' : 'text-[var(--text-muted)]'} />}
                            <span>{tab.label}</span>
                            {isActive && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-t-full shadow-[0_-2px_6px_rgba(var(--brand-rgb),0.3)] animate-in fade-in slide-in-from-bottom-1 duration-300" />
                            )}
                        </button>
                    );
                }

                // Default 'boxed' variant
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onTabChange(tab.id)}
                        className={`px-8 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 rounded-t-xl h-full flex items-center justify-center gap-2 ${
                            isActive
                                ? 'text-brand border-brand bg-brand/5'
                                : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] opacity-60 hover:opacity-100'
                        }`}
                    >
                        {tab.icon && <Icon name={tab.icon} size={14} />}
                        <span>{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
};
