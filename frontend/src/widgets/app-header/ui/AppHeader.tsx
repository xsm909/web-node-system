import React from 'react';
import { Icon } from '../../../shared/ui/icon';
import { Header } from '../../../shared/ui/header';

interface AppHeaderProps {
    onToggleSidebar: () => void;
    isSidebarOpen?: boolean;
    leftContent?: React.ReactNode;
    rightContent?: React.ReactNode;
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
    searchPlaceholder?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
    onToggleSidebar,
    isSidebarOpen = false,
    leftContent,
    rightContent,
    searchQuery,
    onSearchChange,
    searchPlaceholder = "Search..."
}) => {
    return (
        <Header
            leftContent={
                <>
                    <button
                        className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] lg:hidden transition-colors shrink-0"
                        onClick={onToggleSidebar}
                        aria-label="Toggle menu"
                    >
                        <Icon name={isSidebarOpen ? "close" : "menu"} size={22} className={!isSidebarOpen ? "text-brand" : ""} />
                    </button>
                    {leftContent}
                </>
            }
            rightContent={
                <>
                    {onSearchChange && (
                        <div className="relative flex-1 min-w-[200px] lg:w-[320px] ml-auto">
                            <Icon name="search" size={14} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 text-[var(--text-main)]" />
                            <input
                                value={searchQuery || ''}
                                onChange={e => onSearchChange(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="w-full bg-surface-800 border border-[var(--border-base)] rounded-2xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40 transition-all shadow-inner"
                            />
                        </div>
                    )}
                    {rightContent}
                </>
            }
        />
    );
};
