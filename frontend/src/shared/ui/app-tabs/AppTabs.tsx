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
        <div className={`flex gap-1.5 items-end relative -mb-px ${className}`}>
            {tabs.map(tab => {
                const isActive = activeTab === tab.id;

                if (variant === 'underline') {
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onTabChange(tab.id)}
                            className={`px-6 py-5 text-sm font-bold transition-all relative flex items-center gap-2.5 ${isActive ? 'text-brand' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] opacity-60 hover:opacity-100'
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
                        className={`px-4 py-1.5 text-sm font-semibold transition-all relative flex items-center justify-center gap-2 rounded-t-lg -mb-px ${isActive
                            ? 'text-brand bg-[var(--bg-app)] border-t border-l border-r border-[var(--border-base)] shadow-[0_-2px_6px_rgba(0,0,0,0.02)] z-10'
                            : 'text-[var(--text-muted)] border-t border-l border-r border-transparent hover:text-[var(--text-main)] hover:bg-[var(--border-muted)]/40 hover:border-[var(--border-muted)]/40'
                            }`}
                    >
                        {tab.icon && <Icon name={tab.icon} size={16} />}
                        <span className="relative z-20">{tab.label}</span>
                        {isActive && (
                            <div className="absolute inset-0 bg-brand/[0.03] rounded-t-lg z-10" />
                        )}
                    </button>
                );
            })}
        </div>
    );
};
