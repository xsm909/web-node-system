import React from 'react';
import { Icon } from '../../../shared/ui/icon';

interface AppHeaderProps {
    onToggleSidebar: () => void;
    isSidebarOpen?: boolean;
    leftContent?: React.ReactNode;
    rightContent?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
    onToggleSidebar,
    isSidebarOpen = false,
    leftContent,
    rightContent,
}) => {
    return (
        <header className="sticky top-0 z-50 flex items-center justify-between px-4 lg:px-8 bg-surface-900/80 backdrop-blur-md border-b border-[var(--border-base)] h-16 shrink-0">
            <div className="flex items-center gap-3 lg:gap-4 flex-1 min-w-0">
                <button
                    className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] lg:hidden transition-colors shrink-0"
                    onClick={onToggleSidebar}
                    aria-label="Toggle menu"
                >
                    <Icon name={isSidebarOpen ? "close" : "menu"} size={22} className={!isSidebarOpen ? "text-brand" : ""} />
                </button>
                {leftContent}
            </div>

            {rightContent && (
                <div className="flex items-center gap-2 lg:gap-4 shrink-0">
                    {rightContent}
                </div>
            )}
        </header>
    );
};
